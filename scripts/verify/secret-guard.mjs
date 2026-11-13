/** Offline, no-network content scan. Never reads actual .env or secrets. Prints only path+rule, not values. */
import {readdir,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
const ignoreDirs=new Set(['.git','.local','node_modules','.dart_tool','build','dist','coverage','releases','artifacts','__pycache__','.idea','.gradle']);
const skipExt=new Set(['.zip','.jpg','.jpeg','.png','.webp','.gif','.pdf','.docx','.pptx','.xlsx','.sqlite','.db','.jar','.so','.dll','.exe','.class']);
const suspiciousFile=/(^\.env(?:\..*)?$|^credentials$|\.pem$|\.p8$|\.p12$|\.pfx$|\.jks$|\.keystore$|\.kdbx$|\.key$|^google-services\.json$|^GoogleService-Info\.plist$|^key\.properties$)/i;
const checks=[
 ['AWS_ACCESS_ID', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
 ['PRIVATE_KEY_BODY', /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
 ['REAL_SIGNED_URL', /(?:X-Amz-Signature=[0-9a-fA-F]{48,}|[?&]Signature=[A-Za-z0-9%_\-]{48,})/],
 ['POSSIBLE_TOKEN', /\b(?:sk_live_|rk_live_|ghp_|github_pat_)[A-Za-z0-9_\-]{16,}/],
];
const problems=[];
async function walk(base){
 for(const entry of await readdir(base,{withFileTypes:true})){
  const full=path.join(base,entry.name);
  if(entry.isSymbolicLink()) {problems.push([full,'SYMLINK_NOT_ALLOWED']);continue;}
  if(entry.isDirectory()){if(!ignoreDirs.has(entry.name))await walk(full);continue;}
  const b=entry.name;
  if (b==='.env.example'||b.endsWith('.env.example')) {/* safe placeholder example */}
  else if(suspiciousFile.test(b)) { /* Private owner files may exist, do NOT read them. Package script excludes them. */ continue; }
  if(skipExt.has(path.extname(b).toLowerCase()))continue;
  if((await lstat(full)).size>3_000_000){problems.push([full,'UNEXPECTED_LARGE_TEXT_FILE']);continue;}
  const t=await readFile(full,'utf8');
  for(const [name,re] of checks)if(re.test(t))problems.push([full,name]);
 }
}
for(const p of ['apps','docs','infra','scripts'])await walk(p);
for(const p of ['AGENTS.md','README.md','.gitignore','package.json','.editorconfig']){
 try{const t=await readFile(p,'utf8');for(const [name,re] of checks)if(re.test(t))problems.push([p,name]);}catch{}
}
if(problems.length){for(const [file,reason] of problems)console.error(`BLOCKED ${reason}: ${file}`);process.exit(1);}
console.log('PASS: offline source/docs secret scan (never opened private .env/credential files)');
