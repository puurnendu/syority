-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WbsNodeType" AS ENUM ('EVENT', 'UNIT', 'SYSTEM', 'HO_WBS', 'TO_WBS', 'EQUIPMENT', 'WORKPACK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WorkpackStatus" AS ENUM ('pending_ai_review', 'draft', 'under_review', 'approved', 'issued', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'on_hold', 'cancelled');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('FS', 'SS', 'FF', 'SF');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('pending', 'reserved', 'issued', 'returned', 'cancelled');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "WorkflowAction" AS ENUM ('submit', 'approve', 'reject', 'issue', 'close', 'cancel', 'reopen');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('pending_review', 'in_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "SuggestedItemStatus" AS ENUM ('pending_review', 'added_to_catalog', 'linked', 'dismissed');

-- CreateEnum
CREATE TYPE "TighteningMethod" AS ENUM ('torque', 'tensioning', 'manual');

-- CreateEnum
CREATE TYPE "JointStatus" AS ENUM ('pending', 'assembled', 'inspected', 'signed_off', 'dismantled');

-- CreateEnum
CREATE TYPE "BlindType" AS ENUM ('spectacle', 'paddle', 'figure_8', 'blind_flange', 'blanking_disc');

-- CreateEnum
CREATE TYPE "BlindTestType" AS ENUM ('pressure', 'leak', 'functional', 'not_required');

-- CreateEnum
CREATE TYPE "BlindStatus" AS ENUM ('pending', 'inserted', 'pressure_tested', 'removed', 'cancelled');

-- CreateEnum
CREATE TYPE "ConstraintType" AS ENUM ('material', 'permit', 'scaffold', 'access', 'vendor', 'document', 'manpower', 'equipment', 'weather', 'inspection', 'other');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ConstraintStatus" AS ENUM ('open', 'in_progress', 'resolved', 'deferred', 'cancelled');

-- CreateEnum
CREATE TYPE "PunchCategory" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "PunchStatus" AS ENUM ('open', 'in_progress', 'closed', 'accepted_with_comments');

-- CreateEnum
CREATE TYPE "ToolCategory" AS ENUM ('Rigging', 'Lifting', 'Mechanical', 'Electrical', 'Hydraulic', 'Measurement', 'Safety', 'Cleaning', 'Welding', 'Scaffolding', 'General');

-- CreateEnum
CREATE TYPE "ResourceType2" AS ENUM ('labor', 'material', 'machine');

-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('dropping', 'boxup');

-- CreateEnum
CREATE TYPE "CleaningMethod" AS ENUM ('chemical_flush', 'hp_water', 'steam', 'mechanical_pigging', 'solvent');

-- CreateEnum
CREATE TYPE "LessonsLearntCategory" AS ENUM ('planning', 'execution', 'materials', 'hse', 'quality', 'vendor', 'design');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "industry" TEXT,
    "country" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "logo_path" TEXT,
    "logo_url" TEXT,
    "logo_width_px" INTEGER DEFAULT 140,
    "logo_height_px" INTEGER DEFAULT 40,
    "sidebar_logo_url" TEXT,
    "sidebar_logo_width_px" INTEGER DEFAULT 120,
    "sidebar_logo_height_px" INTEGER DEFAULT 36,
    "favicon_url" TEXT,
    "primary_color" TEXT DEFAULT '#4F46E5',
    "platform_name" TEXT DEFAULT 'SYORITY',
    "is_active" BOOLEAN DEFAULT true,
    "settings" JSONB,
    "activity_id_increment" INTEGER NOT NULL DEFAULT 3,
    "workpack_pdf_columns" JSONB DEFAULT '{"showWindow":true,"showDuration":true,"showManpower":false,"showContractor":true,"showPredecessor":false,"showScaffolding":true,"showElectrical":true}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "contract_start_date" TIMESTAMP(3),
    "contract_end_date" TIMESTAMP(3),
    "contract_value" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "billing_cycle" TEXT DEFAULT 'annual',
    "payment_status" TEXT DEFAULT 'active',
    "last_payment_date" TIMESTAMP(3),
    "last_payment_amount" DOUBLE PRECISION,
    "payment_notes" TEXT,
    "plan_tier" TEXT DEFAULT 'professional',
    "max_users" INTEGER DEFAULT 15,
    "max_sites" INTEGER DEFAULT 3,
    "feature_flags" JSONB DEFAULT '{}',
    "status" TEXT DEFAULT 'active',
    "suspended_at" TIMESTAMP(3),
    "suspension_reason" TEXT,
    "terminated_at" TIMESTAMP(3),
    "onboarded_by" TEXT,
    "onboarded_at" TIMESTAMP(3),
    "account_manager" TEXT,
    "account_manager_email" TEXT,
    "technical_contact" TEXT,
    "technical_email" TEXT,
    "notes" TEXT,
    "deployment_model" TEXT DEFAULT 'shared',
    "vps_hostname" TEXT,
    "vps_region" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "location" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "pressure_test_standard" TEXT NOT NULL DEFAULT 'ASME_VIII',
    "hydrotest_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "pneumatic_test_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.1,
    "torque_standard" TEXT NOT NULL DEFAULT 'ASME_PCC_1',
    "test_standard_notes" TEXT,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "permissions" JSONB,
    "is_system" BOOLEAN DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employee_id" TEXT,
    "password" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "whatsapp_number" TEXT,
    "whatsapp_verified" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "preferred_language" TEXT DEFAULT 'en',
    "avatar_path" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "remember_token" TEXT,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_tenant_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "site_id" UUID,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT 'turnaround',
    "planned_start" DATE,
    "planned_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "scope_notes" TEXT,
    "budget_manhours" INTEGER,
    "budget_cost" DECIMAL(15,2),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyLog" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "project_id" UUID,
    "log_date" DATE NOT NULL,
    "shift" TEXT NOT NULL DEFAULT 'day',
    "manpower_planned" INTEGER NOT NULL DEFAULT 0,
    "manpower_actual" INTEGER NOT NULL DEFAULT 0,
    "lti" INTEGER NOT NULL DEFAULT 0,
    "lti_days_lost" INTEGER NOT NULL DEFAULT 0,
    "near_miss" INTEGER NOT NULL DEFAULT 0,
    "first_aid" INTEGER NOT NULL DEFAULT 0,
    "medical_treatment" INTEGER NOT NULL DEFAULT 0,
    "dangerous_occurrence" INTEGER NOT NULL DEFAULT 0,
    "ptw_issued" INTEGER NOT NULL DEFAULT 0,
    "ptw_closed" INTEGER NOT NULL DEFAULT 0,
    "ptw_suspended" INTEGER NOT NULL DEFAULT 0,
    "toolbox_talks" INTEGER NOT NULL DEFAULT 0,
    "manhours_worked" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "manhours_planned" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cumulative_manhours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cumulative_lti" INTEGER NOT NULL DEFAULT 0,
    "lti_frequency_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "safety_notes" TEXT,
    "submitted_by" TEXT,
    "submitted_by_name" TEXT,
    "last_updated_by" TEXT,
    "last_updated_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyIncident" (
    "id" UUID NOT NULL,
    "safety_id" TEXT,
    "safety_log_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "incident_date" TIMESTAMP(3) NOT NULL,
    "incident_time" TEXT,
    "incident_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Low',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "unit_area" TEXT,
    "contractor" TEXT,
    "persons_involved" TEXT,
    "immediate_action" TEXT,
    "root_cause" TEXT,
    "root_cause_category" TEXT,
    "contributing_factors" TEXT,
    "corrective_actions" TEXT,
    "preventive_actions" TEXT,
    "lesson_learned" TEXT,
    "action_owner" TEXT,
    "action_due_date" DATE,
    "action_completed_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "investigation_by" TEXT,
    "closed_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "remarks" TEXT,
    "reported_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyPhoto" (
    "id" UUID NOT NULL,
    "safety_log_id" UUID,
    "incident_id" UUID,
    "event_id" UUID NOT NULL,
    "photo_type" TEXT NOT NULL DEFAULT 'general',
    "caption" TEXT,
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "uploaded_by" TEXT,
    "uploaded_by_name" TEXT,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_units" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "event_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "System" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criticality" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "p_and_id_ref" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "System_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_blinds" (
    "id" UUID NOT NULL,
    "system_id" UUID NOT NULL,
    "blind_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "line_number" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "inserted_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "responsible_user_id" UUID,
    "workpack_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_blinds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_gaskets" (
    "id" UUID NOT NULL,
    "system_id" UUID NOT NULL,
    "gasket_id" TEXT NOT NULL,
    "joint_ref" TEXT NOT NULL,
    "line_number" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "pressure_rating" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'Required',
    "workpack_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_gaskets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_drawings" (
    "id" UUID NOT NULL,
    "system_id" UUID NOT NULL,
    "drawing_no" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'For Review',
    "file_url" TEXT,
    "date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_procedures" (
    "id" UUID NOT NULL,
    "system_id" UUID NOT NULL,
    "procedure_no" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "owner" TEXT,
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_nodes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "system_id" UUID,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WbsNodeType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "linked_entity_id" UUID,
    "linked_entity_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wbs_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_systems" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "system_id" UUID NOT NULL,

    CONSTRAINT "event_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "system_id" UUID,
    "tag_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset_type" TEXT,
    "sap_equipment_number" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "manufacturer" TEXT,
    "model_number" TEXT,
    "serial_number" TEXT,
    "year_installed" INTEGER,
    "design_pressure_barg" DOUBLE PRECISION,
    "design_temp_c" DOUBLE PRECISION,
    "operating_pressure_barg" DOUBLE PRECISION,
    "operating_temp_c" DOUBLE PRECISION,
    "test_pressure_barg" DOUBLE PRECISION,
    "weight_empty_kg" DOUBLE PRECISION,
    "weight_operating_kg" DOUBLE PRECISION,
    "service_description" TEXT,
    "fluid_service" TEXT,
    "criticality" TEXT,
    "maintenance_strategy" TEXT,
    "inspection_interval_months" INTEGER,
    "p_and_id_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ga_drawing_number" TEXT,
    "isometric_drawing_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plot_area" TEXT,
    "elevation" TEXT,
    "train" TEXT,
    "sap_functional_location" TEXT,
    "extracted_from_document_id" UUID,
    "extraction_confidence" DOUBLE PRECISION,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nozzles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "designation" TEXT NOT NULL,
    "service" TEXT,
    "nominal_size_inches" DOUBLE PRECISION,
    "pressure_rating" TEXT,
    "flange_face" TEXT,
    "flange_standard" TEXT,
    "gasket_type" TEXT,
    "gasket_material" TEXT,
    "bolt_spec" TEXT,
    "bolt_count" INTEGER,
    "default_torque_nm" DOUBLE PRECISION,
    "p_and_id_number" TEXT,
    "connected_line_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sequence_number" INTEGER DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "nozzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_lists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "system_id" UUID,
    "line_number" TEXT NOT NULL,
    "nominal_size_inches" DOUBLE PRECISION,
    "fluid_service_code" TEXT,
    "sequence_number" TEXT,
    "pipe_class" TEXT,
    "design_pressure_barg" DOUBLE PRECISION,
    "design_temp_c" DOUBLE PRECISION,
    "operating_pressure_barg" DOUBLE PRECISION,
    "test_pressure_barg" DOUBLE PRECISION,
    "insulation_type" TEXT,
    "heat_tracing" BOOLEAN DEFAULT false,
    "material" TEXT,
    "from_asset_id" UUID,
    "from_nozzle_id" UUID,
    "to_asset_id" UUID,
    "to_nozzle_id" UUID,
    "p_and_id_number" TEXT,
    "isometric_number" TEXT,
    "total_joint_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "line_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_lines" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "connection_type" TEXT NOT NULL DEFAULT 'from',

    CONSTRAINT "asset_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joint_masters" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "joint_number" TEXT NOT NULL,
    "joint_type" TEXT NOT NULL DEFAULT 'flanged',
    "asset_id" UUID,
    "nozzle_id" UUID,
    "line_id" UUID,
    "sequence_in_line" INTEGER,
    "nominal_size_inches" DOUBLE PRECISION,
    "pressure_rating" TEXT,
    "flange_face" TEXT,
    "default_gasket_type" TEXT,
    "default_gasket_material" TEXT,
    "default_bolt_spec" TEXT,
    "default_bolt_count" INTEGER,
    "default_torque_nm" DOUBLE PRECISION,
    "last_opened_date" TIMESTAMP(3),
    "last_workpack_id" UUID,
    "total_open_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joint_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_responsibilities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "receives_shift_reports" BOOLEAN NOT NULL DEFAULT false,
    "receives_constraint_alerts" BOOLEAN NOT NULL DEFAULT false,
    "receives_daily_briefing" BOOLEAN NOT NULL DEFAULT false,
    "receives_overdue_alerts" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_responsibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contact_person" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceType" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "discipline_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "resource_type_id" UUID NOT NULL,
    "contractor_id" UUID,
    "name" TEXT NOT NULL,
    "employee_id" TEXT,
    "craft_code" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workpack" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_number" TEXT,
    "workpack_id_code" TEXT,
    "unit_code" TEXT,
    "title" TEXT NOT NULL,
    "revision" TEXT DEFAULT 'R0',
    "sap_work_order" TEXT,
    "sap_notification" TEXT,
    "portfolio_id" UUID,
    "sap_plant_maintenance_order" TEXT,
    "asset_id" UUID,
    "unit_id" UUID,
    "event_id" UUID,
    "plant_id" UUID,
    "system_id" UUID,
    "discipline_id" UUID,
    "contractor_id" UUID,
    "work_type" TEXT,
    "priority" TEXT DEFAULT 'Normal',
    "scope_of_work" TEXT,
    "planned_start_date" DATE,
    "planned_end_date" DATE,
    "estimated_manhours" INTEGER DEFAULT 0,
    "status" "WorkpackStatus" NOT NULL DEFAULT 'draft',
    "overall_progress" INTEGER DEFAULT 0,
    "is_locked" BOOLEAN DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "locked_by" UUID,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "template_id" UUID,
    "equipment_type" TEXT,
    "job_type" TEXT,
    "equipment_technical_data" JSONB DEFAULT '{}',
    "ai_auto_filled" BOOLEAN NOT NULL DEFAULT false,
    "ai_auto_filled_at" TIMESTAMP(3),
    "approval_status" TEXT DEFAULT 'not_submitted',
    "approval_submitted_at" TIMESTAMP(3),
    "approval_decided_at" TIMESTAMP(3),
    "approved_by_name" TEXT,
    "approved_by_email" TEXT,
    "approval_notes" TEXT,
    "project_id" TEXT,

    CONSTRAINT "Workpack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkpackAttachment" (
    "id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "group" TEXT NOT NULL,
    "sub_group" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "attachment_type" TEXT NOT NULL,
    "template_key" TEXT,
    "content" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkpackAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkpackDocument" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "document_type" TEXT DEFAULT 'attachment',
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT DEFAULT 0,
    "title" TEXT,
    "description" TEXT,
    "include_in_pdf" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "source_document_id" UUID,
    "source_pages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "extraction_job_id" UUID,

    CONSTRAINT "WorkpackDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkpackVersion" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "revision" TEXT NOT NULL,
    "status_at_snapshot" TEXT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "change_summary" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkpackVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workpack_id_counters" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "unit_code" TEXT NOT NULL,
    "discipline_code" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workpack_id_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID,
    "event_id" UUID,
    "activity_library_id" UUID,
    "sequence_number" INTEGER DEFAULT 0,
    "activity_number" TEXT,
    "activity_id" TEXT,
    "description" TEXT NOT NULL,
    "responsible" TEXT,
    "work_category" TEXT,
    "discipline_id" UUID,
    "duration_hours" DECIMAL(8,2) DEFAULT 0,
    "window" TEXT,
    "planned_start" DATE,
    "planned_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "progress_percent" INTEGER DEFAULT 0,
    "status" "ActivityStatus" DEFAULT 'not_started',
    "notes" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "color_label" TEXT,
    "hold_point_type" TEXT,
    "hold_point_description" TEXT,
    "p6_object_id" INTEGER,
    "p6_activity_id" TEXT,
    "is_approved_for_scheduling" BOOLEAN DEFAULT false,
    "early_start" TIMESTAMP(3),
    "early_finish" TIMESTAMP(3),
    "late_start" TIMESTAMP(3),
    "late_finish" TIMESTAMP(3),
    "total_float" DECIMAL(12,2),
    "is_critical" BOOLEAN DEFAULT false,
    "manpower_count" INTEGER,
    "manpower_type" TEXT,
    "wbs_code" TEXT,
    "free_float" DOUBLE PRECISION,
    "budgeted_cost" DOUBLE PRECISION,
    "actual_cost" DOUBLE PRECISION,
    "remaining_duration" DOUBLE PRECISION,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRelationship" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "predecessor_id" UUID NOT NULL,
    "successor_id" UUID NOT NULL,
    "relationship_type" "RelationshipType" DEFAULT 'FS',
    "lag_days" INTEGER DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkpackMaterial" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "activity_id" UUID,
    "item_catalog_id" UUID,
    "material_number" TEXT,
    "description" TEXT NOT NULL,
    "unit_of_measure" TEXT NOT NULL,
    "specifications" TEXT,
    "material_category" TEXT DEFAULT 'mechanical',
    "quantity_required" DECIMAL(12,3) DEFAULT 0,
    "quantity_issued" DECIMAL(12,3) DEFAULT 0,
    "quantity_returned" DECIMAL(12,3) DEFAULT 0,
    "unit_cost" DECIMAL(12,2),
    "status" "MaterialStatus" DEFAULT 'pending',
    "required_date" DATE,
    "issue_reference" TEXT,
    "is_critical" BOOLEAN DEFAULT false,
    "notes" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "WorkpackMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_catalog" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sap_material_number" TEXT,
    "sap_plant" TEXT,
    "sap_storage_location" TEXT,
    "sap_material_group" TEXT,
    "item_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "long_description" TEXT,
    "item_category" TEXT NOT NULL DEFAULT 'other',
    "sub_category" TEXT,
    "unit_of_measure" TEXT NOT NULL DEFAULT 'EA',
    "manufacturer" TEXT,
    "manufacturer_part_no" TEXT,
    "specification" TEXT,
    "standard_reference" TEXT,
    "material_grade" TEXT,
    "pipe_size" TEXT,
    "pressure_rating" TEXT,
    "flange_type" TEXT,
    "bolt_nominal_size" TEXT,
    "bolt_length_mm" INTEGER,
    "unit_cost" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "last_sap_sync" TIMESTAMP(3),
    "import_batch_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasket_bolt_lookup" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "pipe_size" TEXT NOT NULL,
    "pressure_class" TEXT NOT NULL,
    "flange_type" TEXT NOT NULL,
    "gasket_item_id" UUID,
    "gasket_description" TEXT,
    "bolt_item_id" UUID,
    "bolt_description" TEXT,
    "bolt_count" INTEGER NOT NULL DEFAULT 4,
    "bolt_length_mm" INTEGER,
    "nut_item_id" UUID,
    "nut_description" TEXT,
    "washer_item_id" UUID,
    "washer_description" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gasket_bolt_lookup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workpack_material_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID,
    "category" TEXT,
    "material_category" TEXT DEFAULT 'mechanical',
    "linked_to" TEXT,
    "item_catalog_id" UUID,
    "sap_material_number" TEXT,
    "item_code" TEXT,
    "description" TEXT NOT NULL,
    "specification" TEXT,
    "unit_of_measure" TEXT NOT NULL DEFAULT 'EA',
    "quantity_required" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "quantity_issued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity_used" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity_returned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "procurement_status" TEXT NOT NULL DEFAULT 'not_requested',
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "lead_time_days" INTEGER,
    "required_by_date" TIMESTAMP(3),
    "unit_cost" DOUBLE PRECISION,
    "total_cost" DOUBLE PRECISION,
    "notes" TEXT,
    "sort_order" INTEGER,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "included_in_pdf" BOOLEAN NOT NULL DEFAULT true,
    "planner_notes" TEXT,
    "custom_name" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workpack_material_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workpack_tools" (
    "id" TEXT NOT NULL,
    "workpack_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category" "ToolCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'EA',
    "tool_type" TEXT NOT NULL DEFAULT 'Standard',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "cert_required" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Required',
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workpack_tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_catalog_import_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "batch_id" TEXT NOT NULL,
    "imported_by" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_catalog_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProviderSetting" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" TEXT DEFAULT 'anthropic',
    "model" TEXT,
    "api_key_encrypted" TEXT,
    "api_endpoint" TEXT,
    "api_version" TEXT,
    "max_tokens" INTEGER DEFAULT 4096,
    "temperature" DOUBLE PRECISION DEFAULT 0.1,
    "is_active" BOOLEAN DEFAULT false,
    "extraction_prompt" TEXT,
    "fallback_provider" TEXT,
    "fallback_api_key_encrypted" TEXT,
    "fallback_model" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "vision_provider" TEXT,
    "vision_model" TEXT,
    "vision_api_key_encrypted" TEXT,
    "whatsapp_provider" TEXT DEFAULT 'openai',
    "whatsapp_model" TEXT DEFAULT 'gpt-4o-mini',
    "whatsapp_api_key_encrypted" TEXT,
    "whisper_api_key_encrypted" TEXT,
    "lessons_provider" TEXT,
    "lessons_model" TEXT,

    CONSTRAINT "AiProviderSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "phone_number" TEXT NOT NULL,
    "user_id" UUID,
    "state" TEXT NOT NULL DEFAULT 'idle',
    "pending_data" JSONB,
    "detected_language" TEXT DEFAULT 'en',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_updates" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "user_id" UUID,
    "phone_number" TEXT NOT NULL,
    "meta_message_id" TEXT,
    "message_type" TEXT NOT NULL,
    "raw_message_text" TEXT,
    "detected_language" TEXT,
    "audio_storage_path" TEXT,
    "audio_file_size_bytes" BIGINT,
    "audio_duration_secs" INTEGER,
    "audio_downloaded_at" TIMESTAMP(3),
    "transcript_path" TEXT,
    "extracted_unit" TEXT,
    "extracted_tag" TEXT,
    "extracted_description" TEXT,
    "extracted_progress" INTEGER,
    "confidence_breakdown" JSONB,
    "ai_confidence" DOUBLE PRECISION,
    "db_confidence" DOUBLE PRECISION,
    "final_confidence" DOUBLE PRECISION,
    "matched_workpack_id" UUID,
    "matched_activity_id" UUID,
    "match_candidates" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_notes" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reply_sent" TEXT,
    "reply_sent_at" TIMESTAMP(3),
    "reply_language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "unit_id" UUID,
    "shift_type" TEXT NOT NULL,
    "shift_start" TIMESTAMP(3) NOT NULL,
    "shift_end" TIMESTAMP(3) NOT NULL,
    "report_text" TEXT NOT NULL,
    "report_summary" TEXT,
    "activities_completed" INTEGER NOT NULL DEFAULT 0,
    "activities_overdue" INTEGER NOT NULL DEFAULT 0,
    "activities_in_progress" INTEGER NOT NULL DEFAULT 0,
    "whatsapp_updates_count" INTEGER NOT NULL DEFAULT 0,
    "open_constraints_count" INTEGER NOT NULL DEFAULT 0,
    "critical_constraints" INTEGER NOT NULL DEFAULT 0,
    "sent_to_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sent_at" TIMESTAMP(3),
    "meta_message_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "delivery_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_shift_report_recipients" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "receives_shift_reports" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_shift_report_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityResource" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "resource_type_id" UUID,
    "resource_id" UUID,
    "contractor_id" UUID,
    "planned_hours" DECIMAL(8,2) DEFAULT 0,
    "actual_hours" DECIMAL(8,2) DEFAULT 0,
    "headcount" INTEGER DEFAULT 1,
    "assigned_date" DATE,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "item_catalog_id" UUID,
    "resource_type" "ResourceType2" NOT NULL DEFAULT 'labor',
    "resource_name" TEXT,
    "crew_size" INTEGER NOT NULL DEFAULT 1,
    "quantity" DECIMAL(10,4),
    "unit" TEXT,

    CONSTRAINT "ActivityResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "form_type" TEXT NOT NULL,
    "description" TEXT,
    "schema_json" JSONB NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "requires_approval" BOOLEAN DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplateVersion" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "form_template_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "schema_json" JSONB NOT NULL,
    "change_notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormInstance" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "form_template_id" UUID NOT NULL,
    "template_version" INTEGER NOT NULL,
    "title" TEXT,
    "sequence_number" INTEGER DEFAULT 0,
    "status" "FormStatus" DEFAULT 'draft',
    "submitted_by" UUID,
    "submitted_at" TIMESTAMP(3),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "FormInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormEntry" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "form_instance_id" UUID NOT NULL,
    "section_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "value" TEXT,
    "value_type" TEXT DEFAULT 'string',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document_type" TEXT,
    "description" TEXT,
    "default_sections" JSONB,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentInstance" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "document_template_id" UUID,
    "tab_title" TEXT NOT NULL,
    "sequence_number" INTEGER DEFAULT 0,
    "content_html" TEXT,
    "content_json" JSONB,
    "document_type" TEXT,
    "revision" TEXT DEFAULT 'R0',
    "is_locked" BOOLEAN DEFAULT false,
    "include_in_pdf" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "DocumentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "reference_type" TEXT NOT NULL,
    "reference_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "stored_filename" TEXT NOT NULL,
    "storage_disk" TEXT DEFAULT 's3',
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" BIGINT DEFAULT 0,
    "file_extension" TEXT,
    "category" TEXT,
    "description" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "action" "WorkflowAction",
    "comment" TEXT,
    "comment_required" BOOLEAN DEFAULT false,
    "performed_by" UUID NOT NULL,
    "performed_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "auditable_type" TEXT NOT NULL,
    "auditable_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "changed_fields" JSONB,
    "user_id" UUID,
    "user_name" TEXT,
    "user_email" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "url" TEXT,
    "method" TEXT,
    "context" TEXT,
    "session_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "notifiable_type" TEXT,
    "notifiable_id" UUID,
    "action_url" TEXT,
    "is_read" BOOLEAN DEFAULT false,
    "read_at" TIMESTAMP(3),
    "triggered_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationDocumentSetting" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "company_name" TEXT,
    "logo_path" TEXT,
    "primary_color" TEXT DEFAULT '#003366',
    "secondary_color" TEXT DEFAULT '#666666',
    "header_html" TEXT,
    "footer_html" TEXT,
    "show_page_numbers" BOOLEAN DEFAULT true,
    "show_logo_all_pages" BOOLEAN DEFAULT true,
    "enable_watermark" BOOLEAN DEFAULT false,
    "watermark_text" TEXT,
    "watermark_color" TEXT DEFAULT '#CCCCCC',
    "number_prefix" TEXT DEFAULT 'WP',
    "number_format" TEXT DEFAULT '{PREFIX}-{YEAR}-{SEQ:5}',
    "page_size" TEXT DEFAULT 'A4',
    "page_orientation" TEXT DEFAULT 'portrait',
    "margins" JSONB,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationDocumentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JointIntegrityItem" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "activity_id" UUID,
    "joint_master_id" UUID,
    "line_number" TEXT,
    "location" TEXT,
    "ai_generated" BOOLEAN DEFAULT false,
    "joint_number" TEXT NOT NULL,
    "tag_id" TEXT,
    "drawing_number" TEXT,
    "pipeline_number" TEXT,
    "pand_id_number" TEXT,
    "specification" TEXT,
    "rating" TEXT,
    "flange_size" TEXT,
    "construct_operation_id" UUID,
    "destruct_operation_id" UUID,
    "flange_material" TEXT,
    "flange_reference_standard" TEXT,
    "gasket_material" TEXT,
    "gasket_reference_standard" TEXT,
    "flange_type" TEXT,
    "gasket_item_id" UUID,
    "bolt_item_id" UUID,
    "bolt_material" TEXT,
    "bolt_reference_standard" TEXT,
    "bolt_diameter" TEXT,
    "bolt_length" TEXT,
    "bolt_quantity" INTEGER,
    "tightening_method" "TighteningMethod",
    "torque_tightening_value" DECIMAL(10,2),
    "torque_pump_pressure" DECIMAL(10,2),
    "torque_tool_reference" TEXT,
    "tensioning_pressure" DECIMAL(10,2),
    "tensioning_residual_bolt_stress" DECIMAL(10,2),
    "tensioning_pass" TEXT,
    "tensioning_tool_reference" TEXT,
    "status" "JointStatus" DEFAULT 'pending',
    "assembled_by" UUID,
    "assembled_at" TIMESTAMP(3),
    "inspected_by" UUID,
    "inspected_at" TIMESTAMP(3),
    "signed_off_by" UUID,
    "signed_off_at" TIMESTAMP(3),
    "notes" TEXT,
    "torque_witness_name" TEXT,
    "torque_witness_signed_at" TIMESTAMP(3),
    "torque_certificate_number" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "JointIntegrityItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blind" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "activity_id" UUID,
    "blind_number" TEXT NOT NULL,
    "blind_type" "BlindType",
    "system" TEXT,
    "pipeline_number" TEXT,
    "pand_id_number" TEXT,
    "location" TEXT,
    "area" TEXT,
    "flange_size" TEXT,
    "rating" TEXT,
    "blind_test_type" "BlindTestType",
    "blind_test_type_description" TEXT,
    "safe_isolation_confirmed" BOOLEAN DEFAULT false,
    "safe_isolation_reference" TEXT,
    "insert_activity_id" UUID,
    "inserted_by" UUID,
    "inserted_at" TIMESTAMP(3),
    "insert_witness" TEXT,
    "remove_activity_id" UUID,
    "removed_by" UUID,
    "removed_at" TIMESTAMP(3),
    "remove_witness" TEXT,
    "status" "BlindStatus" DEFAULT 'pending',
    "actual_test_pressure" DECIMAL(10,2),
    "test_result" TEXT,
    "notes" TEXT,
    "triage_reference" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Blind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Constraint" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "activity_id" UUID,
    "constraint_number" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "constraint_type" "ConstraintType",
    "priority" "Priority" DEFAULT 'high',
    "owner_id" UUID,
    "target_resolution_date" DATE,
    "actual_resolution_date" DATE,
    "status" "ConstraintStatus" DEFAULT 'open',
    "resolution_notes" TEXT,
    "raised_by" UUID,
    "raised_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "closed_by" UUID,
    "closed_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Constraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constraint_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "portfolio_id" UUID,
    "constraint_number" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'technical',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "raised_by" TEXT,
    "raised_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owner" TEXT,
    "target_resolution" TIMESTAMP(3),
    "resolution_steps" TEXT,
    "resolved_by" TEXT,
    "resolved_date" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "impact_on_schedule" TEXT,
    "is_in_central_register" BOOLEAN NOT NULL DEFAULT true,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constraint_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constraint_attachments" (
    "id" UUID NOT NULL,
    "constraint_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT DEFAULT 'application/pdf',
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "constraint_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PunchListItem" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "activity_id" UUID,
    "item_number" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "PunchCategory",
    "discipline_id" UUID,
    "raised_by" UUID,
    "raised_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "drawing_reference" TEXT,
    "assigned_to" UUID,
    "target_close_date" DATE,
    "status" "PunchStatus" DEFAULT 'open',
    "closed_by" UUID,
    "closed_at" TIMESTAMP(3),
    "close_out_notes" TEXT,
    "accepted_by" UUID,
    "accepted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "PunchListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiExtractionJob" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "requested_by" UUID NOT NULL,
    "workpack_id" UUID,
    "status" "AiJobStatus",
    "provider_used" TEXT,
    "model_used" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "processing_seconds" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_usd" DECIMAL(10,6),
    "error_message" TEXT,
    "retry_count" INTEGER DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "work_type_hint" TEXT,
    "discipline_hint" TEXT,
    "additional_instructions" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "AiExtractionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiExtractionResult" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "ai_extraction_job_id" UUID NOT NULL,
    "raw_ai_response" TEXT,
    "extracted_data_json" JSONB NOT NULL,
    "planner_review_json" JSONB,
    "review_status" "DocumentReviewStatus" DEFAULT 'pending_review',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "overall_confidence" DOUBLE PRECISION,
    "field_confidence_json" JSONB,
    "low_confidence_fields" JSONB,
    "materials_extracted" INTEGER DEFAULT 0,
    "materials_matched_catalog" INTEGER DEFAULT 0,
    "materials_unmatched" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiExtractionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_conflicts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "ai_extraction_job_id" UUID NOT NULL,
    "field_path" TEXT NOT NULL,
    "field_label" TEXT NOT NULL,
    "existing_value" TEXT,
    "existing_entered_by" TEXT,
    "existing_entered_at" TIMESTAMP(3),
    "extracted_value" TEXT NOT NULL,
    "source_document_id" UUID NOT NULL,
    "source_page" INTEGER,
    "source_text" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "calculated" BOOLEAN NOT NULL DEFAULT false,
    "calculation_basis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolution" TEXT,
    "resolution_value" TEXT,
    "resolution_note" TEXT NOT NULL DEFAULT '',
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestedItem" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "ai_extraction_job_id" UUID NOT NULL,
    "workpack_material_id" UUID,
    "suggested_name" TEXT NOT NULL,
    "suggested_material_number" TEXT,
    "suggested_category" TEXT,
    "suggested_uom" TEXT,
    "suggested_specifications" TEXT,
    "suggested_quantity" DECIMAL(12,3),
    "source_document" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "ai_reasoning" TEXT,
    "status" "SuggestedItemStatus" DEFAULT 'pending_review',
    "resolved_item_catalog_id" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSuggestedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLibrary" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discipline_id" UUID,
    "duration_hours" DECIMAL(8,2),
    "is_active" BOOLEAN DEFAULT true,
    "activity_code" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "hold_point_type" TEXT,
    "hold_point_description" TEXT,
    "work_category" TEXT,
    "phase" TEXT,
    "level_code" TEXT,

    CONSTRAINT "ActivityLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityUdfDefinition" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_mandatory" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ActivityUdfDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityUdfOption" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "udf_definition_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code_value" TEXT,
    "description" TEXT,
    "sort_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ActivityUdfOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLibraryUdfDefault" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "activity_library_id" UUID NOT NULL,
    "udf_definition_id" UUID NOT NULL,
    "udf_option_id" UUID,
    "value_string" TEXT,
    "value_number" DECIMAL(10,2),
    "value_date" DATE,
    "value_boolean" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityLibraryUdfDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityUdfValue" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "udf_definition_id" UUID NOT NULL,
    "udf_option_id" UUID,
    "value_string" TEXT,
    "value_number" DECIMAL(10,2),
    "value_date" DATE,
    "value_boolean" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityUdfValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleExportJob" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "status" TEXT NOT NULL,
    "file_path" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_import_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "status" TEXT NOT NULL,
    "file_path" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workpack_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "equipment_type" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workpack_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workpack_template_activities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL DEFAULT 0,
    "activity_code" TEXT,
    "activity_library_id" UUID,
    "description" TEXT NOT NULL,
    "duration_hours" DECIMAL(8,2),
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "hold_point_type" TEXT,
    "hold_point_description" TEXT,
    "udf_defaults" JSONB,
    "predecessor_sequences" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workpack_template_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_checklist_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "checklist_type" "ChecklistType" NOT NULL,
    "sequence_number" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "responsible_party" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_clearance_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "cleared_by" UUID NOT NULL,
    "cleared_at" TIMESTAMP(3) NOT NULL,
    "certificate_number" TEXT,
    "witness_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_clearance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dropping_boxup_checklists" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "checklist_type" "ChecklistType" NOT NULL,
    "created_from_template_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dropping_boxup_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dropping_boxup_checklist_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "responsible_party" TEXT,
    "target_date" TIMESTAMP(3),
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "signed_by" UUID,
    "signed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dropping_boxup_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workpack_print_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "updated_by" UUID,
    "cover_image_path" TEXT,
    "cover_image_opacity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cover_show" BOOLEAN NOT NULL DEFAULT true,
    "cover_title_variable" TEXT NOT NULL DEFAULT '{workpack_number} ??? {title}',
    "cover_subtitle_variable" TEXT NOT NULL DEFAULT '{org_name} | {site_name}',
    "cover_accent_color" TEXT NOT NULL DEFAULT '#E8701A',
    "cover_bg_color" TEXT NOT NULL DEFAULT '#0D2137',
    "header_zones" JSONB NOT NULL DEFAULT '{}',
    "header_bg_color" TEXT NOT NULL DEFAULT '#0D2137',
    "header_text_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "header_height_mm" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "header_show_border" BOOLEAN NOT NULL DEFAULT false,
    "header_border_color" TEXT NOT NULL DEFAULT '#E8701A',
    "footer_zones" JSONB NOT NULL DEFAULT '{}',
    "footer_bg_color" TEXT NOT NULL DEFAULT '#0D2137',
    "footer_text_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "footer_height_mm" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "footer_show_border" BOOLEAN NOT NULL DEFAULT true,
    "footer_border_color" TEXT NOT NULL DEFAULT '#E8701A',
    "page_size" TEXT NOT NULL DEFAULT 'A4',
    "margin_top_mm" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "margin_bottom_mm" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "margin_left_mm" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "margin_right_mm" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "watermark_text" TEXT,
    "watermark_draft_only" BOOLEAN NOT NULL DEFAULT true,
    "logo_library" JSONB NOT NULL DEFAULT '[]',
    "cover_page_settings" JSONB,
    "last_page_settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workpack_print_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_clearance_parties" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "party_name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "sequence_number" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_clearance_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_for_boxup" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clearance_for_boxup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_sign_offs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "clearance_id" UUID NOT NULL,
    "party_name" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "signed_by" UUID,
    "signed_at" TIMESTAMP(3),
    "signature_path" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clearance_sign_offs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cleaning_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "workpack_id" UUID NOT NULL,
    "activity_id" UUID,
    "created_by" UUID NOT NULL,
    "certificate_number" TEXT,
    "cleaning_method" "CleaningMethod" NOT NULL,
    "cleaning_medium" TEXT,
    "concentration" TEXT,
    "temperature_c" DECIMAL(5,2),
    "duration_hours" DECIMAL(8,2),
    "is_standalone" BOOLEAN NOT NULL DEFAULT false,
    "before_condition" TEXT,
    "after_condition" TEXT,
    "remaining_deposits" TEXT,
    "inspector_acceptance" BOOLEAN NOT NULL DEFAULT false,
    "inspector_id" UUID,
    "inspected_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cleaning_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_completion_certificates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "certificate_number" TEXT,
    "scope_summary" TEXT,
    "activities_completed" INTEGER,
    "open_punch_cat_b" INTEGER NOT NULL DEFAULT 0,
    "open_punch_cat_c" INTEGER NOT NULL DEFAULT 0,
    "pressure_tests_status" TEXT,
    "materials_summary" TEXT,
    "lessons_learnt_summary" TEXT,
    "maint_engineer_id" UUID,
    "maint_engineer_signed_at" TIMESTAMP(3),
    "operations_id" UUID,
    "operations_signed_at" TIMESTAMP(3),
    "qa_id" UUID,
    "qa_signed_at" TIMESTAMP(3),
    "client_name" TEXT,
    "client_signed_at" TIMESTAMP(3),
    "client_signature_path" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_completion_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "cert_type" TEXT NOT NULL,
    "cert_name" TEXT NOT NULL,
    "equipment_types" TEXT[],
    "fields" JSONB NOT NULL,
    "is_platform" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_instances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "cert_number" TEXT,
    "cert_type" TEXT NOT NULL,
    "cert_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "field_values" JSONB NOT NULL DEFAULT '{}',
    "prepared_by" TEXT,
    "prepared_date" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_date" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_date" TIMESTAMP(3),
    "third_party_inspector" TEXT,
    "third_party_date" TIMESTAMP(3),
    "pass_fail" TEXT,
    "remarks" TEXT,
    "include_in_pdf" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons_learnt" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "site_id" UUID,
    "workpack_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "category" "LessonsLearntCategory" NOT NULL,
    "what_happened" TEXT NOT NULL,
    "root_cause" TEXT,
    "recommendation" TEXT,
    "applicable_to_future" BOOLEAN NOT NULL DEFAULT true,
    "equipment_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "lessons_learnt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons_learned" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workpack_id" UUID NOT NULL,
    "portfolio_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "recommendation" TEXT,
    "applicable_to" TEXT[],
    "is_in_central_register" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewed_by" TEXT,
    "reviewed_date" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_learned_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_code_default_resources" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "library_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "quantity" DECIMAL(10,2) DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_code_default_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "client" TEXT,
    "location" TEXT,
    "plant_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Planning',
    "planned_sd_date" TIMESTAMP(3),
    "planned_su_date" TIMESTAMP(3),
    "forecast_sd_date" TIMESTAMP(3),
    "forecast_su_date" TIMESTAMP(3),
    "actual_sd_date" TIMESTAMP(3),
    "actual_su_date" TIMESTAMP(3),
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_units" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "unit_id" TEXT,
    "equipment_type_id" TEXT,
    "tag" TEXT NOT NULL,
    "description" TEXT,
    "area" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "year_of_manufacture" INTEGER,
    "technical_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_constraints" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "workpack_id" TEXT,
    "activity_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "discipline" TEXT,
    "impact" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "due_date" TIMESTAMP(3),
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "workpack_id" TEXT,
    "equipment_id" TEXT,
    "punch_number" TEXT,
    "category" TEXT NOT NULL DEFAULT 'B',
    "description" TEXT NOT NULL,
    "discipline" TEXT,
    "location" TEXT,
    "raised_by" TEXT,
    "assigned_to" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "due_date" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "remarks" TEXT,
    "photo_paths" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "punch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "workpack_id" TEXT,
    "activity_id" TEXT,
    "permit_number" TEXT NOT NULL,
    "permit_type" TEXT NOT NULL,
    "work_description" TEXT,
    "location" TEXT,
    "issued_by" TEXT,
    "issued_at" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "extended_until" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "precautions" TEXT,
    "gas_test_result" TEXT,
    "closed_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressLog" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "log_date" TIMESTAMP(3) NOT NULL,
    "progress_percent" DECIMAL(65,30) NOT NULL,
    "manhours_actual" DECIMAL(65,30),
    "logged_by" UUID,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" UUID,
    "recorded_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "data_date" TIMESTAMP(3),
    "percent_complete" DOUBLE PRECISION,
    "actual_cost" DOUBLE PRECISION,
    "recorded_by" UUID,

    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_history" (
    "id" TEXT NOT NULL,
    "org_id" UUID NOT NULL,
    "project_id" UUID,
    "format" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "workpack_count" INTEGER NOT NULL,
    "activity_count" INTEGER NOT NULL,
    "file_size_bytes" INTEGER,
    "exported_by" UUID,
    "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocLibrary" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "event_id" TEXT,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "revision" TEXT,
    "document_number" TEXT,
    "equipment_tags" TEXT[],
    "tags" TEXT[],
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "page_count" INTEGER,
    "ai_summary" TEXT,
    "ai_text" TEXT,
    "ai_indexed" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" TEXT,
    "uploaded_by_name" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "is_org_library" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleBaseline" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScheduleBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineActivity" (
    "id" UUID NOT NULL,
    "baseline_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "planned_start" TIMESTAMP(3) NOT NULL,
    "planned_finish" TIMESTAMP(3) NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "budgeted_cost" DOUBLE PRECISION,

    CONSTRAINT "BaselineActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleCalendar" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "work_days" INTEGER[],
    "hours_per_day" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "exceptions" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_is_active_idx" ON "Organization"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Site_organization_id_code_key" ON "Site"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organization_id_slug_key" ON "Role"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsapp_number_key" ON "User"("whatsapp_number");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_user_id_role_id_site_id_key" ON "UserRole"("user_id", "role_id", "site_id");

-- CreateIndex
CREATE INDEX "events_organization_id_status_idx" ON "events"("organization_id", "status");

-- CreateIndex
CREATE INDEX "events_site_id_idx" ON "events"("site_id");

-- CreateIndex
CREATE INDEX "SafetyLog_event_id_log_date_idx" ON "SafetyLog"("event_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyLog_event_id_log_date_key" ON "SafetyLog"("event_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "event_units_event_id_unit_id_key" ON "event_units"("event_id", "unit_id");

-- CreateIndex
CREATE INDEX "System_organization_id_idx" ON "System"("organization_id");

-- CreateIndex
CREATE INDEX "System_site_id_unit_id_idx" ON "System"("site_id", "unit_id");

-- CreateIndex
CREATE INDEX "system_blinds_system_id_idx" ON "system_blinds"("system_id");

-- CreateIndex
CREATE INDEX "system_gaskets_system_id_idx" ON "system_gaskets"("system_id");

-- CreateIndex
CREATE INDEX "system_drawings_system_id_idx" ON "system_drawings"("system_id");

-- CreateIndex
CREATE INDEX "system_procedures_system_id_idx" ON "system_procedures"("system_id");

-- CreateIndex
CREATE INDEX "wbs_nodes_organization_id_event_id_idx" ON "wbs_nodes"("organization_id", "event_id");

-- CreateIndex
CREATE INDEX "wbs_nodes_system_id_idx" ON "wbs_nodes"("system_id");

-- CreateIndex
CREATE INDEX "wbs_nodes_parent_id_idx" ON "wbs_nodes"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_systems_event_id_system_id_key" ON "event_systems"("event_id", "system_id");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_organization_id_tag_number_key" ON "Asset"("organization_id", "tag_number");

-- CreateIndex
CREATE INDEX "nozzles_asset_id_idx" ON "nozzles"("asset_id");

-- CreateIndex
CREATE INDEX "line_lists_unit_id_idx" ON "line_lists"("unit_id");

-- CreateIndex
CREATE INDEX "line_lists_system_id_idx" ON "line_lists"("system_id");

-- CreateIndex
CREATE UNIQUE INDEX "line_lists_organization_id_line_number_key" ON "line_lists"("organization_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "asset_lines_asset_id_line_id_key" ON "asset_lines"("asset_id", "line_id");

-- CreateIndex
CREATE UNIQUE INDEX "joint_masters_nozzle_id_key" ON "joint_masters"("nozzle_id");

-- CreateIndex
CREATE INDEX "joint_masters_asset_id_idx" ON "joint_masters"("asset_id");

-- CreateIndex
CREATE INDEX "joint_masters_line_id_idx" ON "joint_masters"("line_id");

-- CreateIndex
CREATE UNIQUE INDEX "joint_masters_organization_id_joint_number_key" ON "joint_masters"("organization_id", "joint_number");

-- CreateIndex
CREATE INDEX "unit_responsibilities_organization_id_role_idx" ON "unit_responsibilities"("organization_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "unit_responsibilities_unit_id_user_id_role_key" ON "unit_responsibilities"("unit_id", "user_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_organization_id_code_key" ON "Discipline"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Workpack_workpack_id_code_key" ON "Workpack"("workpack_id_code");

-- CreateIndex
CREATE INDEX "Workpack_organization_id_status_idx" ON "Workpack"("organization_id", "status");

-- CreateIndex
CREATE INDEX "Workpack_organization_id_site_id_status_idx" ON "Workpack"("organization_id", "site_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Workpack_organization_id_workpack_number_key" ON "Workpack"("organization_id", "workpack_number");

-- CreateIndex
CREATE INDEX "WorkpackAttachment_workpack_id_idx" ON "WorkpackAttachment"("workpack_id");

-- CreateIndex
CREATE INDEX "WorkpackDocument_workpack_id_idx" ON "WorkpackDocument"("workpack_id");

-- CreateIndex
CREATE INDEX "WorkpackDocument_organization_id_idx" ON "WorkpackDocument"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkpackVersion_workpack_id_revision_key" ON "WorkpackVersion"("workpack_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "workpack_id_counters_organization_id_unit_code_discipline_c_key" ON "workpack_id_counters"("organization_id", "unit_code", "discipline_code");

-- CreateIndex
CREATE INDEX "Activity_workpack_id_sequence_number_idx" ON "Activity"("workpack_id", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRelationship_predecessor_id_successor_id_key" ON "ActivityRelationship"("predecessor_id", "successor_id");

-- CreateIndex
CREATE INDEX "WorkpackMaterial_workpack_id_status_idx" ON "WorkpackMaterial"("workpack_id", "status");

-- CreateIndex
CREATE INDEX "WorkpackMaterial_item_catalog_id_idx" ON "WorkpackMaterial"("item_catalog_id");

-- CreateIndex
CREATE INDEX "item_catalog_organization_id_item_category_idx" ON "item_catalog"("organization_id", "item_category");

-- CreateIndex
CREATE INDEX "item_catalog_organization_id_sap_material_number_idx" ON "item_catalog"("organization_id", "sap_material_number");

-- CreateIndex
CREATE INDEX "item_catalog_organization_id_pipe_size_pressure_rating_idx" ON "item_catalog"("organization_id", "pipe_size", "pressure_rating");

-- CreateIndex
CREATE UNIQUE INDEX "item_catalog_organization_id_item_code_key" ON "item_catalog"("organization_id", "item_code");

-- CreateIndex
CREATE INDEX "gasket_bolt_lookup_organization_id_idx" ON "gasket_bolt_lookup"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "gasket_bolt_lookup_organization_id_pipe_size_pressure_class_key" ON "gasket_bolt_lookup"("organization_id", "pipe_size", "pressure_class", "flange_type");

-- CreateIndex
CREATE INDEX "workpack_material_lines_workpack_id_idx" ON "workpack_material_lines"("workpack_id");

-- CreateIndex
CREATE INDEX "workpack_material_lines_workpack_id_source_type_idx" ON "workpack_material_lines"("workpack_id", "source_type");

-- CreateIndex
CREATE INDEX "workpack_material_lines_workpack_id_item_catalog_id_idx" ON "workpack_material_lines"("workpack_id", "item_catalog_id");

-- CreateIndex
CREATE INDEX "workpack_material_lines_material_category_idx" ON "workpack_material_lines"("material_category");

-- CreateIndex
CREATE INDEX "workpack_material_lines_included_in_pdf_idx" ON "workpack_material_lines"("included_in_pdf");

-- CreateIndex
CREATE INDEX "workpack_tools_workpack_id_idx" ON "workpack_tools"("workpack_id");

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderSetting_organization_id_key" ON "AiProviderSetting"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_phone_number_key" ON "whatsapp_sessions"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_user_id_key" ON "whatsapp_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_updates_meta_message_id_key" ON "whatsapp_updates"("meta_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_updates_organization_id_status_idx" ON "whatsapp_updates"("organization_id", "status");

-- CreateIndex
CREATE INDEX "whatsapp_updates_phone_number_created_at_idx" ON "whatsapp_updates"("phone_number", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_updates_matched_workpack_id_idx" ON "whatsapp_updates"("matched_workpack_id");

-- CreateIndex
CREATE INDEX "shift_reports_organization_id_shift_start_idx" ON "shift_reports"("organization_id", "shift_start");

-- CreateIndex
CREATE INDEX "shift_reports_unit_id_idx" ON "shift_reports"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "unit_shift_report_recipients_unit_id_user_id_key" ON "unit_shift_report_recipients"("unit_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplate_organization_id_slug_key" ON "FormTemplate"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "FormTemplateVersion_form_template_id_version_number_key" ON "FormTemplateVersion"("form_template_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "FormEntry_form_instance_id_section_id_field_id_key" ON "FormEntry"("form_instance_id", "section_id", "field_id");

-- CreateIndex
CREATE INDEX "DocumentInstance_workpack_id_sequence_number_idx" ON "DocumentInstance"("workpack_id", "sequence_number");

-- CreateIndex
CREATE INDEX "Attachment_reference_type_reference_id_idx" ON "Attachment"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "WorkflowTransition_workpack_id_performed_at_idx" ON "WorkflowTransition"("workpack_id", "performed_at");

-- CreateIndex
CREATE INDEX "AuditLog_auditable_type_auditable_id_idx" ON "AuditLog"("auditable_type", "auditable_id");

-- CreateIndex
CREATE INDEX "AuditLog_organization_id_created_at_idx" ON "AuditLog"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_created_at_idx" ON "AuditLog"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Notification_user_id_is_read_created_at_idx" ON "Notification"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "Notification_notifiable_type_notifiable_id_idx" ON "Notification"("notifiable_type", "notifiable_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDocumentSetting_organization_id_key" ON "OrganizationDocumentSetting"("organization_id");

-- CreateIndex
CREATE INDEX "JointIntegrityItem_workpack_id_status_idx" ON "JointIntegrityItem"("workpack_id", "status");

-- CreateIndex
CREATE INDEX "JointIntegrityItem_workpack_id_activity_id_idx" ON "JointIntegrityItem"("workpack_id", "activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "JointIntegrityItem_workpack_id_joint_number_key" ON "JointIntegrityItem"("workpack_id", "joint_number");

-- CreateIndex
CREATE INDEX "Blind_workpack_id_status_idx" ON "Blind"("workpack_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Blind_workpack_id_blind_number_key" ON "Blind"("workpack_id", "blind_number");

-- CreateIndex
CREATE INDEX "Constraint_workpack_id_status_idx" ON "Constraint"("workpack_id", "status");

-- CreateIndex
CREATE INDEX "Constraint_workpack_id_constraint_type_status_idx" ON "Constraint"("workpack_id", "constraint_type", "status");

-- CreateIndex
CREATE INDEX "Constraint_owner_id_status_idx" ON "Constraint"("owner_id", "status");

-- CreateIndex
CREATE INDEX "constraint_logs_organization_id_idx" ON "constraint_logs"("organization_id");

-- CreateIndex
CREATE INDEX "constraint_logs_workpack_id_idx" ON "constraint_logs"("workpack_id");

-- CreateIndex
CREATE INDEX "constraint_logs_status_idx" ON "constraint_logs"("status");

-- CreateIndex
CREATE INDEX "PunchListItem_workpack_id_status_idx" ON "PunchListItem"("workpack_id", "status");

-- CreateIndex
CREATE INDEX "PunchListItem_workpack_id_category_status_idx" ON "PunchListItem"("workpack_id", "category", "status");

-- CreateIndex
CREATE INDEX "AiExtractionJob_organization_id_status_idx" ON "AiExtractionJob"("organization_id", "status");

-- CreateIndex
CREATE INDEX "AiExtractionJob_requested_by_created_at_idx" ON "AiExtractionJob"("requested_by", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "AiExtractionResult_ai_extraction_job_id_key" ON "AiExtractionResult"("ai_extraction_job_id");

-- CreateIndex
CREATE INDEX "extraction_conflicts_workpack_id_status_idx" ON "extraction_conflicts"("workpack_id", "status");

-- CreateIndex
CREATE INDEX "extraction_conflicts_ai_extraction_job_id_idx" ON "extraction_conflicts"("ai_extraction_job_id");

-- CreateIndex
CREATE INDEX "AiSuggestedItem_organization_id_status_idx" ON "AiSuggestedItem"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityUdfDefinition_organization_id_code_key" ON "ActivityUdfDefinition"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityUdfOption_udf_definition_id_code_value_key" ON "ActivityUdfOption"("udf_definition_id", "code_value");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityUdfValue_activity_id_udf_definition_id_key" ON "ActivityUdfValue"("activity_id", "udf_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "workpack_templates_organization_id_equipment_type_job_type_key" ON "workpack_templates"("organization_id", "equipment_type", "job_type");

-- CreateIndex
CREATE UNIQUE INDEX "dropping_boxup_checklists_workpack_id_checklist_type_key" ON "dropping_boxup_checklists"("workpack_id", "checklist_type");

-- CreateIndex
CREATE UNIQUE INDEX "workpack_print_settings_organization_id_key" ON "workpack_print_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "clearance_for_boxup_workpack_id_key" ON "clearance_for_boxup"("workpack_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_completion_certificates_workpack_id_key" ON "job_completion_certificates"("workpack_id");

-- CreateIndex
CREATE INDEX "certificate_instances_workpack_id_idx" ON "certificate_instances"("workpack_id");

-- CreateIndex
CREATE INDEX "lessons_learned_organization_id_idx" ON "lessons_learned"("organization_id");

-- CreateIndex
CREATE INDEX "lessons_learned_workpack_id_idx" ON "lessons_learned"("workpack_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_code_default_resources_library_id_resource_id_key" ON "activity_code_default_resources"("library_id", "resource_id");

-- CreateIndex
CREATE INDEX "export_history_org_id_idx" ON "export_history"("org_id");

-- AddForeignKey
ALTER TABLE "billing_logs" ADD CONSTRAINT "billing_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyLog" ADD CONSTRAINT "SafetyLog_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_safety_log_id_fkey" FOREIGN KEY ("safety_log_id") REFERENCES "SafetyLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyPhoto" ADD CONSTRAINT "SafetyPhoto_safety_log_id_fkey" FOREIGN KEY ("safety_log_id") REFERENCES "SafetyLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyPhoto" ADD CONSTRAINT "SafetyPhoto_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "SafetyIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyPhoto" ADD CONSTRAINT "SafetyPhoto_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_units" ADD CONSTRAINT "event_units_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_units" ADD CONSTRAINT "event_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_blinds" ADD CONSTRAINT "system_blinds_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_blinds" ADD CONSTRAINT "system_blinds_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_gaskets" ADD CONSTRAINT "system_gaskets_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_drawings" ADD CONSTRAINT "system_drawings_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_procedures" ADD CONSTRAINT "system_procedures_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "wbs_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_systems" ADD CONSTRAINT "event_systems_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_systems" ADD CONSTRAINT "event_systems_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nozzles" ADD CONSTRAINT "nozzles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nozzles" ADD CONSTRAINT "nozzles_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_lists" ADD CONSTRAINT "line_lists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_lists" ADD CONSTRAINT "line_lists_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_lists" ADD CONSTRAINT "line_lists_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_lists" ADD CONSTRAINT "line_lists_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_lists" ADD CONSTRAINT "line_lists_from_asset_id_fkey" FOREIGN KEY ("from_asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_lists" ADD CONSTRAINT "line_lists_from_nozzle_id_fkey" FOREIGN KEY ("from_nozzle_id") REFERENCES "nozzles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_lists" ADD CONSTRAINT "line_lists_to_asset_id_fkey" FOREIGN KEY ("to_asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_lists" ADD CONSTRAINT "line_lists_to_nozzle_id_fkey" FOREIGN KEY ("to_nozzle_id") REFERENCES "nozzles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lines" ADD CONSTRAINT "asset_lines_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lines" ADD CONSTRAINT "asset_lines_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "line_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_masters" ADD CONSTRAINT "joint_masters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_masters" ADD CONSTRAINT "joint_masters_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_masters" ADD CONSTRAINT "joint_masters_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_masters" ADD CONSTRAINT "joint_masters_nozzle_id_fkey" FOREIGN KEY ("nozzle_id") REFERENCES "nozzles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_masters" ADD CONSTRAINT "joint_masters_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "line_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_responsibilities" ADD CONSTRAINT "unit_responsibilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_responsibilities" ADD CONSTRAINT "unit_responsibilities_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_responsibilities" ADD CONSTRAINT "unit_responsibilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipline" ADD CONSTRAINT "Discipline_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discipline" ADD CONSTRAINT "Discipline_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceType" ADD CONSTRAINT "ResourceType_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceType" ADD CONSTRAINT "ResourceType_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceType" ADD CONSTRAINT "ResourceType_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "ResourceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workpack" ADD CONSTRAINT "Workpack_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackAttachment" ADD CONSTRAINT "WorkpackAttachment_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackDocument" ADD CONSTRAINT "WorkpackDocument_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "WorkpackDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackVersion" ADD CONSTRAINT "WorkpackVersion_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackVersion" ADD CONSTRAINT "WorkpackVersion_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackVersion" ADD CONSTRAINT "WorkpackVersion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_id_counters" ADD CONSTRAINT "workpack_id_counters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_activity_library_id_fkey" FOREIGN KEY ("activity_library_id") REFERENCES "ActivityLibrary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRelationship" ADD CONSTRAINT "ActivityRelationship_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRelationship" ADD CONSTRAINT "ActivityRelationship_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRelationship" ADD CONSTRAINT "ActivityRelationship_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRelationship" ADD CONSTRAINT "ActivityRelationship_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackMaterial" ADD CONSTRAINT "WorkpackMaterial_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackMaterial" ADD CONSTRAINT "WorkpackMaterial_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackMaterial" ADD CONSTRAINT "WorkpackMaterial_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackMaterial" ADD CONSTRAINT "WorkpackMaterial_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackMaterial" ADD CONSTRAINT "WorkpackMaterial_item_catalog_id_fkey" FOREIGN KEY ("item_catalog_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackMaterial" ADD CONSTRAINT "WorkpackMaterial_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkpackMaterial" ADD CONSTRAINT "WorkpackMaterial_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_catalog" ADD CONSTRAINT "item_catalog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasket_bolt_lookup" ADD CONSTRAINT "gasket_bolt_lookup_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasket_bolt_lookup" ADD CONSTRAINT "gasket_bolt_lookup_gasket_item_id_fkey" FOREIGN KEY ("gasket_item_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasket_bolt_lookup" ADD CONSTRAINT "gasket_bolt_lookup_bolt_item_id_fkey" FOREIGN KEY ("bolt_item_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasket_bolt_lookup" ADD CONSTRAINT "gasket_bolt_lookup_nut_item_id_fkey" FOREIGN KEY ("nut_item_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasket_bolt_lookup" ADD CONSTRAINT "gasket_bolt_lookup_washer_item_id_fkey" FOREIGN KEY ("washer_item_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_material_lines" ADD CONSTRAINT "workpack_material_lines_item_catalog_id_fkey" FOREIGN KEY ("item_catalog_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_material_lines" ADD CONSTRAINT "workpack_material_lines_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_material_lines" ADD CONSTRAINT "workpack_material_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_tools" ADD CONSTRAINT "workpack_tools_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_tools" ADD CONSTRAINT "workpack_tools_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_catalog_import_logs" ADD CONSTRAINT "item_catalog_import_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderSetting" ADD CONSTRAINT "AiProviderSetting_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderSetting" ADD CONSTRAINT "AiProviderSetting_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderSetting" ADD CONSTRAINT "AiProviderSetting_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_updates" ADD CONSTRAINT "whatsapp_updates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_updates" ADD CONSTRAINT "whatsapp_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_updates" ADD CONSTRAINT "whatsapp_updates_matched_workpack_id_fkey" FOREIGN KEY ("matched_workpack_id") REFERENCES "Workpack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_updates" ADD CONSTRAINT "whatsapp_updates_matched_activity_id_fkey" FOREIGN KEY ("matched_activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_updates" ADD CONSTRAINT "whatsapp_updates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_shift_report_recipients" ADD CONSTRAINT "unit_shift_report_recipients_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_shift_report_recipients" ADD CONSTRAINT "unit_shift_report_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_resource_type_id_fkey" FOREIGN KEY ("resource_type_id") REFERENCES "ResourceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResource" ADD CONSTRAINT "ActivityResource_item_catalog_id_fkey" FOREIGN KEY ("item_catalog_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateVersion" ADD CONSTRAINT "FormTemplateVersion_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateVersion" ADD CONSTRAINT "FormTemplateVersion_form_template_id_fkey" FOREIGN KEY ("form_template_id") REFERENCES "FormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplateVersion" ADD CONSTRAINT "FormTemplateVersion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_form_template_id_fkey" FOREIGN KEY ("form_template_id") REFERENCES "FormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormInstance" ADD CONSTRAINT "FormInstance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEntry" ADD CONSTRAINT "FormEntry_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEntry" ADD CONSTRAINT "FormEntry_form_instance_id_fkey" FOREIGN KEY ("form_instance_id") REFERENCES "FormInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEntry" ADD CONSTRAINT "FormEntry_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInstance" ADD CONSTRAINT "DocumentInstance_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInstance" ADD CONSTRAINT "DocumentInstance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInstance" ADD CONSTRAINT "DocumentInstance_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInstance" ADD CONSTRAINT "DocumentInstance_document_template_id_fkey" FOREIGN KEY ("document_template_id") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInstance" ADD CONSTRAINT "DocumentInstance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentInstance" ADD CONSTRAINT "DocumentInstance_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDocumentSetting" ADD CONSTRAINT "OrganizationDocumentSetting_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationDocumentSetting" ADD CONSTRAINT "OrganizationDocumentSetting_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_joint_master_id_fkey" FOREIGN KEY ("joint_master_id") REFERENCES "joint_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_construct_operation_id_fkey" FOREIGN KEY ("construct_operation_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_destruct_operation_id_fkey" FOREIGN KEY ("destruct_operation_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_gasket_item_id_fkey" FOREIGN KEY ("gasket_item_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_bolt_item_id_fkey" FOREIGN KEY ("bolt_item_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_assembled_by_fkey" FOREIGN KEY ("assembled_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_inspected_by_fkey" FOREIGN KEY ("inspected_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_signed_off_by_fkey" FOREIGN KEY ("signed_off_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JointIntegrityItem" ADD CONSTRAINT "JointIntegrityItem_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_insert_activity_id_fkey" FOREIGN KEY ("insert_activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_inserted_by_fkey" FOREIGN KEY ("inserted_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_remove_activity_id_fkey" FOREIGN KEY ("remove_activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blind" ADD CONSTRAINT "Blind_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Constraint" ADD CONSTRAINT "Constraint_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraint_logs" ADD CONSTRAINT "constraint_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraint_logs" ADD CONSTRAINT "constraint_logs_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraint_attachments" ADD CONSTRAINT "constraint_attachments_constraint_id_fkey" FOREIGN KEY ("constraint_id") REFERENCES "constraint_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractionJob" ADD CONSTRAINT "AiExtractionJob_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractionJob" ADD CONSTRAINT "AiExtractionJob_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractionJob" ADD CONSTRAINT "AiExtractionJob_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractionJob" ADD CONSTRAINT "AiExtractionJob_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractionJob" ADD CONSTRAINT "AiExtractionJob_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractionResult" ADD CONSTRAINT "AiExtractionResult_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractionResult" ADD CONSTRAINT "AiExtractionResult_ai_extraction_job_id_fkey" FOREIGN KEY ("ai_extraction_job_id") REFERENCES "AiExtractionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExtractionResult" ADD CONSTRAINT "AiExtractionResult_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_conflicts" ADD CONSTRAINT "extraction_conflicts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_conflicts" ADD CONSTRAINT "extraction_conflicts_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_conflicts" ADD CONSTRAINT "extraction_conflicts_ai_extraction_job_id_fkey" FOREIGN KEY ("ai_extraction_job_id") REFERENCES "AiExtractionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestedItem" ADD CONSTRAINT "AiSuggestedItem_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestedItem" ADD CONSTRAINT "AiSuggestedItem_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestedItem" ADD CONSTRAINT "AiSuggestedItem_ai_extraction_job_id_fkey" FOREIGN KEY ("ai_extraction_job_id") REFERENCES "AiExtractionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestedItem" ADD CONSTRAINT "AiSuggestedItem_workpack_material_id_fkey" FOREIGN KEY ("workpack_material_id") REFERENCES "WorkpackMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestedItem" ADD CONSTRAINT "AiSuggestedItem_resolved_item_catalog_id_fkey" FOREIGN KEY ("resolved_item_catalog_id") REFERENCES "item_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestedItem" ADD CONSTRAINT "AiSuggestedItem_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLibrary" ADD CONSTRAINT "ActivityLibrary_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLibrary" ADD CONSTRAINT "ActivityLibrary_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "Discipline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLibrary" ADD CONSTRAINT "ActivityLibrary_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfDefinition" ADD CONSTRAINT "ActivityUdfDefinition_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfDefinition" ADD CONSTRAINT "ActivityUdfDefinition_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfOption" ADD CONSTRAINT "ActivityUdfOption_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfOption" ADD CONSTRAINT "ActivityUdfOption_udf_definition_id_fkey" FOREIGN KEY ("udf_definition_id") REFERENCES "ActivityUdfDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfOption" ADD CONSTRAINT "ActivityUdfOption_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLibraryUdfDefault" ADD CONSTRAINT "ActivityLibraryUdfDefault_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLibraryUdfDefault" ADD CONSTRAINT "ActivityLibraryUdfDefault_activity_library_id_fkey" FOREIGN KEY ("activity_library_id") REFERENCES "ActivityLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLibraryUdfDefault" ADD CONSTRAINT "ActivityLibraryUdfDefault_udf_definition_id_fkey" FOREIGN KEY ("udf_definition_id") REFERENCES "ActivityUdfDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLibraryUdfDefault" ADD CONSTRAINT "ActivityLibraryUdfDefault_udf_option_id_fkey" FOREIGN KEY ("udf_option_id") REFERENCES "ActivityUdfOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfValue" ADD CONSTRAINT "ActivityUdfValue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfValue" ADD CONSTRAINT "ActivityUdfValue_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfValue" ADD CONSTRAINT "ActivityUdfValue_udf_definition_id_fkey" FOREIGN KEY ("udf_definition_id") REFERENCES "ActivityUdfDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUdfValue" ADD CONSTRAINT "ActivityUdfValue_udf_option_id_fkey" FOREIGN KEY ("udf_option_id") REFERENCES "ActivityUdfOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleExportJob" ADD CONSTRAINT "ScheduleExportJob_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleExportJob" ADD CONSTRAINT "ScheduleExportJob_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleExportJob" ADD CONSTRAINT "ScheduleExportJob_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_import_jobs" ADD CONSTRAINT "schedule_import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_import_jobs" ADD CONSTRAINT "schedule_import_jobs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_import_jobs" ADD CONSTRAINT "schedule_import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_templates" ADD CONSTRAINT "workpack_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_template_activities" ADD CONSTRAINT "workpack_template_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_template_activities" ADD CONSTRAINT "workpack_template_activities_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workpack_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_template_activities" ADD CONSTRAINT "workpack_template_activities_activity_library_id_fkey" FOREIGN KEY ("activity_library_id") REFERENCES "ActivityLibrary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_checklist_items" ADD CONSTRAINT "template_checklist_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_checklist_items" ADD CONSTRAINT "template_checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workpack_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_clearance_records" ADD CONSTRAINT "qa_clearance_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_clearance_records" ADD CONSTRAINT "qa_clearance_records_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_clearance_records" ADD CONSTRAINT "qa_clearance_records_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dropping_boxup_checklists" ADD CONSTRAINT "dropping_boxup_checklists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dropping_boxup_checklists" ADD CONSTRAINT "dropping_boxup_checklists_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dropping_boxup_checklist_items" ADD CONSTRAINT "dropping_boxup_checklist_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dropping_boxup_checklist_items" ADD CONSTRAINT "dropping_boxup_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "dropping_boxup_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workpack_print_settings" ADD CONSTRAINT "workpack_print_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_clearance_parties" ADD CONSTRAINT "org_clearance_parties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_for_boxup" ADD CONSTRAINT "clearance_for_boxup_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_for_boxup" ADD CONSTRAINT "clearance_for_boxup_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_sign_offs" ADD CONSTRAINT "clearance_sign_offs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_sign_offs" ADD CONSTRAINT "clearance_sign_offs_clearance_id_fkey" FOREIGN KEY ("clearance_id") REFERENCES "clearance_for_boxup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_records" ADD CONSTRAINT "cleaning_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_records" ADD CONSTRAINT "cleaning_records_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_records" ADD CONSTRAINT "cleaning_records_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_records" ADD CONSTRAINT "cleaning_records_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_completion_certificates" ADD CONSTRAINT "job_completion_certificates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_completion_certificates" ADD CONSTRAINT "job_completion_certificates_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_instances" ADD CONSTRAINT "certificate_instances_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_instances" ADD CONSTRAINT "certificate_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learnt" ADD CONSTRAINT "lessons_learnt_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learnt" ADD CONSTRAINT "lessons_learnt_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learnt" ADD CONSTRAINT "lessons_learnt_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_code_default_resources" ADD CONSTRAINT "activity_code_default_resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_code_default_resources" ADD CONSTRAINT "activity_code_default_resources_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "ActivityLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_code_default_resources" ADD CONSTRAINT "activity_code_default_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_units" ADD CONSTRAINT "project_units_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "project_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "EquipmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_constraints" ADD CONSTRAINT "project_constraints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_constraints" ADD CONSTRAINT "project_constraints_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_workpack_id_fkey" FOREIGN KEY ("workpack_id") REFERENCES "Workpack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_history" ADD CONSTRAINT "export_history_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineActivity" ADD CONSTRAINT "BaselineActivity_baseline_id_fkey" FOREIGN KEY ("baseline_id") REFERENCES "ScheduleBaseline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

