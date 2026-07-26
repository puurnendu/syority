# SECTION 8 — AUDIT REPORT (Complete Output)

## 1. AI call function (workpackGenerator.ts) — vision support

**Path:** `src/lib/ai/workpackGenerator.ts`

- **Content:** Text-only. `generateWorkpackWithAi(config, prompt)` calls OpenAI `chat/completions` or Gemini `generateContent` with a single text prompt. No image/content-parts support.
- **Vision:** Not present. Step 8B adds a separate VisionAiService for image inputs.

---

## 2. workpackSchema validation

**Path:** `src/lib/ai/workpackSchema.ts`

- Exports: `aiWorkpackResponseSchema`, `validateAiWorkpackResponse`, `AiWorkpackResponse`.
- Validates: scope_of_work, activities[], materials[], constraints[], blinds[], qa_requirements, estimated_total_manhours.
- No vision or extraction-specific schemas.

---

## 3. AiProviderSetting model — full definition

```prisma
model AiProviderSetting {
  id                         String       @id @default(uuid()) @db.Uuid
  organization_id            String       @unique @db.Uuid
  organization               Organization @relation(fields: [organization_id], references: [id])
  provider                   String?      @default("anthropic")
  model                      String?
  api_key_encrypted          String?      @db.Text
  api_endpoint               String?
  api_version                String?
  max_tokens                 Int?         @default(4096)
  temperature                Float?       @default(0.1)
  is_active                  Boolean?     @default(false)
  extraction_prompt          String?      @db.Text
  fallback_provider          String?
  fallback_api_key_encrypted String?      @db.Text
  fallback_model             String?
  created_by                 String?      @db.Uuid
  creator                    User?        @relation("AiSettingCreator", fields: [created_by], references: [id])
  updated_by                 String?      @db.Uuid
  updater                    User?        @relation("AiSettingUpdater", fields: [updated_by], references: [id])
  created_at                 DateTime     @default(now())
  updated_at                 DateTime     @updatedAt
}
```

---

## 4. ChecklistType enum

```prisma
enum ChecklistType {
  dropping
  boxup
}
```

---

## 5. CleaningRecord model (Workpack relation)

```prisma
model CleaningRecord {
  id                   String         @id @default(uuid()) @db.Uuid
  organization_id      String         @db.Uuid
  organization        Organization   @relation(fields: [organization_id], references: [id])
  site_id             String?        @db.Uuid
  site                Site?          @relation(fields: [site_id], references: [id])
  workpack_id         String         @db.Uuid
  workpack            Workpack       @relation(fields: [workpack_id], references: [id], onDelete: Cascade)
  activity_id         String?        @db.Uuid
  activity            Activity?     @relation(fields: [activity_id], references: [id])
  created_by          String         @db.Uuid
  certificate_number  String?
  cleaning_method     CleaningMethod
  cleaning_medium     String?
  concentration       String?
  temperature_c       Decimal?       @db.Decimal(5, 2)
  duration_hours      Decimal?       @db.Decimal(8, 2)
  is_standalone       Boolean        @default(false)
  before_condition    String?        @db.Text
  after_condition     String?        @db.Text
  remaining_deposits  String?        @db.Text
  inspector_acceptance Boolean       @default(false)
  inspector_id        String?        @db.Uuid
  inspected_at        DateTime?
  notes               String?        @db.Text
  created_at          DateTime       @default(now())
  updated_at          DateTime       @updatedAt
  deleted_at          DateTime?

  @@map("cleaning_records")
}
```

**Note:** No `CleaningInstruction` model. Extraction accept route will map cleaning_instructions to CleaningRecord (notes / cleaning_medium / duration_hours).

---

## 6. CertificateInstance — full model

```prisma
model CertificateInstance {
  id                    String    @id @default(uuid()) @db.Uuid
  organization_id       String    @db.Uuid
  workpack_id           String    @db.Uuid
  workpack              Workpack  @relation(fields: [workpack_id], references: [id], onDelete: Cascade)
  template_id           String    @db.Uuid
  template              CertificateTemplate @relation(fields: [template_id], references: [id], onDelete: Cascade)
  cert_number           String?
  cert_type             String
  cert_name             String
  status                String    @default("not_started")
  field_values          Json      @default("{}")
  prepared_by           String?
  prepared_date         DateTime?
  reviewed_by           String?
  reviewed_date         DateTime?
  approved_by           String?
  approved_date         DateTime?
  third_party_inspector String?
  third_party_date      DateTime?
  pass_fail             String?
  remarks               String?   @db.Text
  include_in_pdf         Boolean   @default(true)
  deleted_at            DateTime?
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  @@index([workpack_id])
  @@map("certificate_instances")
}
```

---

## 7. JointIntegrityItem — full model (excerpt)

- workpack_id, site_id, organization_id, activity_id; joint_number; tag_id, drawing_number, pipeline_number, pand_id_number, specification, rating, flange_size; flange_material, gasket_material, torque_tightening_value, etc.; status, assembled_by, inspected_by, signed_off_by; created_by, creator, updated_at, deleted_at.
- Relations: workpack, site, organization, activity, construct_activity, destruct_activity, gasket_item, bolt_item, assembler, inspector, sign_off_user, creator, updater.

---

## 8. Blind — full model (excerpt)

- workpack_id, site_id, organization_id, activity_id; blind_number, blind_type, system, pipeline_number, pand_id_number, location, area; flange_size, rating, blind_test_type; safe_isolation_*, insert_activity_id, remove_activity_id; status; created_at, updated_at, deleted_at.

---

## 9. Existing upload directory structure

```
uploads/
  workpacks/
```

(uploads/ exists; contains workpacks.)

---

## 10. guardApi pattern (apiGuard)

**Path:** `src/lib/apiGuard.ts`

- `export async function guardApi(permission: Permission): Promise<{ session; error }>`
- `export function orgScope(session): { orgId, userId, role, isSuperAdmin }`
- Lines: guardApi at 6, orgScope at 39.

---

## 11. TypeScript baseline

```
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
→ 0
```

(0 errors.)

---

## Post-implementation notes

- **Migration:** `npx prisma migrate dev --name add_ai_extraction_v2` failed in this environment (shadow DB / existing migration state). Schema changes are applied and `npx prisma generate` succeeded. Run the migration when your DB is in sync with the migration history.
- **CleaningRecord:** No `CleaningInstruction` model exists. Document extract “accept” route maps `cleaning_instructions` to `CleaningRecord` (notes, cleaning_medium, duration_hours, etc.).
- **LessonLearned:** No `created_by` on model; accept route omits it and sets `applicable_to: []`.
- **8G:** Site engineering standards PATCH uses permission `settings.org.edit` (no generic `settings.edit` in permissions).
