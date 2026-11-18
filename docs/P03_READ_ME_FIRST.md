# P03 — Read me first

**For the current P03-1/P03-2 implementation, start at [`p03/README.md`](p03/README.md).** It is the maintained navigation for current user journeys, architecture, geo storage, HTTP/internal APIs, automated acceptance evidence and safe documentation cleanup.

P03-1 private manual/GPS locality and the P03-2 backend-only H3 resolution-6 discovery query foundation have **passed the owner's full Windows/DynamoDB/Flutter/Android automated 11-gate acceptance twice on 18 November 2026**. The device tests then covered only three isolated UI scenarios. **Expanded Android full-journey tests are included in the latest update but have not yet been run by the owner**; see [`p03/04_ACCEPTANCE_AND_RELEASE_GATES.md`](p03/04_ACCEPTANCE_AND_RELEASE_GATES.md). Real native GPS, real account OS relaunch and live CloudFront still require independent manual acceptance.

The completed-profile tab order is **Dating, Friendship, Local Feed (with Activities), Connects, Settings**. Incomplete profiles show **Dating/setup and Settings**. No Home tab. The app still exposes no public discovery results and creates no discovery publication pointers; P03-3 onward must implement eligibility/publication before enabling discovery.

The broad [`implementation/phases/P03.md`](implementation/phases/P03.md) describes the *whole planned phase*, not finished functionality. PIN-code search remains on hold. P01/P02 authentication/session docs and canonical product documents are not modified by this P03-only consolidation.
