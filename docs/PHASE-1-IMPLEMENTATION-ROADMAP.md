# AURIANOA OS Phase-1 Implementation Roadmap

**Status:** Performance fixes applied ✅ | Architecture buildout in progress  
**Last Updated:** 2025-02-27

---

## ✅ COMPLETED (Performance Fixes - Appendix A)

- [x] **Fix 1:** Prisma singleton with connection pooling (`src/lib/prisma.ts`)
- [x] **Fix 2:** Workpacks list uses `revalidate = 10` (no force-dynamic)
- [x] **Fix 3:** Workpack detail page has no force-dynamic (ISR enabled)
- [x] **Fix 5:** Loading.tsx files added for all routes
- [x] **Fix 7:** Providers directly imported in layout (no dynamic import)

---

## 🏗️ ARCHITECTURE STATUS

### ✅ COMPLETE (Existing Services)

| Service | Location | Status |
|---------|----------|--------|
| WorkpackService | `src/modules/Workpack/Services/WorkpackService.ts` | ✅ Complete |
| ActivityService | `src/modules/Activity/Services/ActivityService.ts` | ✅ Complete |
| WorkflowService | `src/modules/Workpack/Services/WorkflowService.ts` | ✅ Complete |
| JointIntegrityService | `src/modules/JointIntegrity/Services/JointIntegrityService.ts` | ✅ Complete |
| BlindService | `src/modules/Blinds/Services/BlindService.ts` | ✅ Complete |
| ConstraintService | `src/modules/Constraints/Services/ConstraintService.ts` | ✅ Complete |
| PunchListService | `src/modules/PunchList/Services/PunchListService.ts` | ✅ Complete |
| WorkpackMaterialService | `src/modules/Workpack/Services/WorkpackMaterialService.ts` | ✅ Complete |

### ⚠️ MISSING (Critical for Phase-1)

#### OS Foundation Services
- [ ] **ConsumableService** — Central catalog CRUD + search (`src/core/master-data/services/ConsumableService.ts`)
- [ ] **ActivityLibraryService** — Library CRUD + createActivityFromLibrary (`src/core/master-data/services/ActivityLibraryService.ts`)
- [ ] **ActivityUdfService** — UDF definitions, values, validation (`src/core/master-data/services/ActivityUdfService.ts`)
- [ ] **OrganizationService** — Org CRUD (if not exists) (`src/core/tenant/services/OrganizationService.ts`)
- [ ] **UserService** — User CRUD + password hashing (`src/core/tenant/services/UserService.ts`)

#### Workpack Module Services
- [ ] **FormTemplateService** — Template CRUD + auto-versioning (`src/modules/forms/services/FormTemplateService.ts`)
- [ ] **FormInstanceService** — Instance CRUD + schema rendering (`src/modules/forms/services/FormInstanceService.ts`)
- [ ] **DocumentInstanceService** — Document CRUD + reorder (`src/modules/documents/services/DocumentInstanceService.ts`)
- [ ] **AttachmentService** — S3 upload + polymorphic attachments (`src/modules/attachments/services/AttachmentService.ts`)
- [ ] **WorkpackVersionService** — Auto-snapshot on status change (`src/modules/workpack/services/WorkpackVersionService.ts`)

#### Platform Services
- [ ] **AuditService** — Append-only audit logging (`src/lib/audit.ts`)
- [ ] **NotificationService** — In-app notifications + email (`src/lib/notifications.ts`)
- [ ] **EventBus** — Typed cross-module events (`src/lib/eventBus.ts`)

#### PDF & Scheduling
- [ ] **PdfService** — Puppeteer PDF generation (`src/modules/pdf/services/PdfService.ts`)
- [ ] **ScheduleExportService** — P6/MS Project XML export (`src/modules/scheduling/services/ScheduleExportService.ts`)
- [ ] **ScheduleImportService** — P6/MS Project XML import (`src/modules/scheduling/services/ScheduleImportService.ts`)
- [ ] **P6XmlFormatter** — Oracle P6 XML formatter (`src/modules/scheduling/formatters/P6XmlFormatter.ts`)
- [ ] **MsProjectXmlFormatter** — MS Project XML formatter (`src/modules/scheduling/formatters/MsProjectXmlFormatter.ts`)

#### AI Services
- [ ] **AiManager** — Provider factory (`src/core/ai/AiManager.ts`)
- [ ] **AnthropicDriver** — Claude driver (`src/core/ai/drivers/AnthropicDriver.ts`)
- [ ] **OpenAiDriver** — GPT-4o driver (`src/core/ai/drivers/OpenAiDriver.ts`)
- [ ] **GeminiDriver** — Gemini driver (`src/core/ai/drivers/GeminiDriver.ts`)
- [ ] **AzureOpenAiDriver** — Azure OpenAI driver (`src/core/ai/drivers/AzureOpenAiDriver.ts`)
- [ ] **AiExtractionService** — Orchestration (`src/core/ai/services/AiExtractionService.ts`)
- [ ] **AiCatalogMatchingService** — Material matching (`src/core/ai/services/AiCatalogMatchingService.ts`)
- [ ] **AiWorkpackBuilderService** — Build workpack from AI result (`src/core/ai/services/AiWorkpackBuilderService.ts`)
- [ ] **AiProviderSettingsService** — Settings CRUD (`src/core/ai/services/AiProviderSettingsService.ts`)

---

## 📋 IMPLEMENTATION PRIORITY

### **Sprint 1: Foundation Services (Critical Path)**
1. **AuditService** — Required by all mutations
2. **EventBus** — Required for cross-module communication
3. **ConsumableService** — Required for materials catalog
4. **NotificationService** — Required for workflow events

### **Sprint 2: Form & Document Engines**
1. **FormTemplateService** + **FormInstanceService**
2. **DocumentInstanceService**
3. **AttachmentService** (S3 integration)

### **Sprint 3: PDF Generation**
1. **PdfService** with Puppeteer
2. **GenerateWorkpackPdf** BullMQ job
3. PDF template React component

### **Sprint 4: Scheduling Export/Import**
1. **ActivityUdfService** — UDF management
2. **ActivityLibraryService** — Library management
3. **ScheduleExportService** + **P6XmlFormatter** + **MsProjectXmlFormatter**
4. **ScheduleImportService** + import review UI

### **Sprint 5: AI Extraction Pipeline**
1. **AiManager** + driver interfaces
2. **AnthropicDriver** (first working driver)
3. **AiExtractionService** + **ProcessAiWorkpackExtraction** job
4. **AiCatalogMatchingService**
5. **AiWorkpackBuilderService**
6. AI review UI

---

## 🔧 NEXT STEPS

1. **Start with AuditService** — Foundation for all mutations
2. **Build EventBus** — Cross-module communication
3. **Implement ConsumableService** — Materials catalog
4. **Add NotificationService** — Workflow notifications
5. **Wire AuditService into all existing services** — Retrofit audit logging

---

## 📝 NOTES

- All services must follow the pattern: validate input → call Prisma → call AuditService.log() → return typed result
- No service may import from another module's service — use EventBus for cross-module communication
- All mutations must write to audit_logs via AuditService
- All workflow transitions must trigger notifications via NotificationService
