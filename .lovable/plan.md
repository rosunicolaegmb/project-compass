

## Repopulate Delivery Roles

The `delivery_roles` table was emptied during the fresh-start cleanup. We need to insert a standard set of IT project delivery roles.

### Proposed roles

| Name | Level | Description |
|------|-------|-------------|
| Project Manager | Senior | Manages project delivery and stakeholders |
| Tech Lead | Senior | Technical leadership and architecture |
| Senior Developer | Senior | Senior software development |
| Developer | Mid | Software development |
| Junior Developer | Junior | Entry-level development |
| Business Analyst | Mid | Requirements and business analysis |
| QA Engineer | Mid | Quality assurance and testing |
| DevOps Engineer | Mid | Infrastructure and CI/CD |
| UX Designer | Mid | User experience and interface design |
| Scrum Master | Senior | Agile process facilitation |
| Solutions Architect | Senior | Solution design and technical strategy |
| Data Engineer | Mid | Data pipelines and analytics |

### Implementation

Single SQL insert into `delivery_roles` using the database insert tool — no schema changes needed.

