# Repair workflow evaluation rubric

Evaluate local fixture outputs only. Prose is workflow evidence, never detector evidence.

| Criterion | Pass condition |
|---|---|
| Evidence state | Preserves `confirmed`, `suspected`, `unknown` or `not_applicable`; no escalation from prose. |
| Plain language | Explains the observed condition without requiring security vocabulary. |
| Consequence | States a realistic outcome and keeps unproven prerequisites conditional. |
| Evidence boundary | Separates what was observed from reachability, exploitability and deployment context. |
| Proposal | Names a concrete reviewable change or explains why no safe change exists. |
| Alternatives | Records a viable alternative when product behavior can differ. |
| Side effects | Names at least one ordinary behavior that can regress. |
| User decision | Does not invent origins, roles, public routes, retention or deployment policy. |
| Security retest | Verifies the weakness-specific condition rather than only compiling. |
| Functional retest | Exercises project-native tests and the affected user journey. |
| Rollback | Names both an observable trigger and an action. |
| Lifecycle integrity | Cannot become `applied` before approval or `retested` before both retests pass. |

Required scenarios are an insecure cookie, unavailable SAST evidence, CORS with an owner-selected
allowlist and an unconfirmed request-to-command lead.
