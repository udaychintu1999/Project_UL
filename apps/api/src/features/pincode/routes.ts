import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PinCatalogue, validPin } from './catalogue.js';

type SessionGuard = (request: FastifyRequest,reply: FastifyReply)=>Promise<{uid:string}|null>;
const error=(reply:FastifyReply,code:number,message:string)=>reply.code(code).send({error:message});

/** P03-1C: authenticated exact PIN lookup only. A postal PIN is NOT a point. */
export function registerIndiaPincodeRoutes(app:FastifyInstance, guard:SessionGuard):void {
  let loading:Promise<PinCatalogue>|null=null;
  const catalogue=()=>loading??=PinCatalogue.open().catch(err=>{loading=null;throw err;});
  app.get<{Params:{pin:string}}>('/v1/geo/india/pincodes/:pin',async(request,reply)=>{
    reply.header('Cache-Control','no-store');
    if(!await guard(request,reply))return reply;
    const {pin}=request.params;
    if(!validPin(pin))return error(reply,400,'invalid_india_pin');
    try {
      const data=await catalogue();
      const offices=await data.lookup(pin);
      if(!offices)return error(reply,404,'india_pin_not_found');
      // Do not collapse the same PIN into a fake geographic centroid. Display
      // distinct offices and require user-confirmed GeoNames manual selection.
      const cap=100;
      return {
        pin,version:data.manifest.version,source:'Department of Posts — All India PIN Code Directory',
        totalOffices:offices.length,truncated:offices.length>cap,
        offices:offices.slice(0,cap),
        requiresManualPlaceConfirmation:true,
        discoveryEnabled:false
      };
    }catch{return error(reply,503,'india_pincode_catalogue_unavailable');}
  });
}
