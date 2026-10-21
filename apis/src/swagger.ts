import swaggerJsdoc from "swagger-jsdoc";
import { config } from "./config.js";

/**
 * OpenAPI 3.0 spec for the UniCore API.
 *
 * Every documented path mirrors a real Express route in src/routes/index.ts,
 * and every request schema mirrors the Zod schemas in src/validation/schemas.ts.
 * Money values in request bodies are decimal strings ("1250.50"); responses
 * expose integer minor units (cents) — matching what the services actually return.
 */

const pathParam = (name: string, description = "Numeric record id") => ({
  in: "path" as const,
  name,
  required: true,
  schema: { type: "integer", minimum: 1 },
  description,
});

const pageQueryParams = (extra: object[] = []) => [
  {
    in: "query",
    name: "page",
    schema: { type: "integer", minimum: 1, default: 1 },
    description: "1-based page number",
  },
  {
    in: "query",
    name: "pageSize",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    description: "Rows per page (max 100)",
  },
  ...extra,
];

const badRequest = { $ref: "#/components/schemas/Error" };
const authed = [{ bearerAuth: [] }];

const ok = (description: string, schemaRef?: string) => ({
  description,
  ...(schemaRef
    ? { content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaRef}` } } } }
    : {}),
});

const created = (description: string, schemaRef: string) => ({
  description,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaRef}` } } },
});

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "UniCore API",
      version: "1.0.0",
      description:
        "REST API for the UniCore university management system, backed live by the SQLite database (db/data/unicore.db via migrations). " +
        "Money values in request bodies are decimal strings, e.g. \"1250.50\". All list endpoints are paginated and read directly from SQLite.",
    },
    // servers: [{ url: `http://localhost:${config.port}`, description: "Local development server" }], ----development
    servers: [{ url: `/`, description: "Production server" }], // ----
    tags: [
      { name: "Auth", description: "Authentication and user session APIs" },
      { name: "Dashboard", description: "Summary data for the dashboard" },
      { name: "Students", description: "Student records, list, and status management" },
      { name: "Programmes", description: "Academic programmes and programme setup" },
      { name: "Departments", description: "Departments and HR reference data" },
      { name: "Employees", description: "Employees and human resources records" },
      { name: "Finance", description: "Fee charges, payments, and reversals" },
      { name: "Users", description: "Administrative user management" },
      { name: "Settings", description: "Application settings" },
      { name: "Import/Export", description: "CSV import and export" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                message: { type: "string", example: "Validation failed" },
                status: { type: "integer", example: 400 },
                details: {
                  type: "object",
                  additionalProperties: { type: "string" },
                  example: { email: "Enter a valid email" },
                },
              },
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "anna-admin@example.com" },
            password: { type: "string", example: "ChangeMe2026!" },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            token: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
            user: { $ref: "#/components/schemas/UserSession" },
          },
        },
        UserSession: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            email: { type: "string", example: "anna-admin@example.com" },
            fullName: { type: "string", example: "System Administrator" },
            roleCode: { type: "string", example: "administrator" },
            roleName: { type: "string", example: "Administrator" },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8, example: "NewStrong2026!" },
          },
        },
        // ---- Students ------------------------------------------------------
        StudentRequest: {
          type: "object",
          required: ["firstName", "lastName", "email", "programmeId", "admissionDate"],
          properties: {
            firstName: { type: "string", example: "Thabo" },
            lastName: { type: "string", example: "Mokoena" },
            email: { type: "string", format: "email", example: "thabo.mokoena@example.edu" },
            phone: { type: "string", example: "" },
            programmeId: { type: "integer", minimum: 1, example: 1 },
            admissionDate: { type: "string", format: "date", example: "2026-02-03" },
            status: { type: "string", enum: ["active", "inactive"], default: "active" },
            studentNumber: { type: "string", example: "STU-01007", description: "Optional manual override; auto-generated when omitted" },
          },
        },
        Student: {
          type: "object",
          properties: {
            id: { type: "integer" },
            studentNumber: { type: "string", example: "STU-01001" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            programmeId: { type: "integer", nullable: true },
            programmeName: { type: "string", nullable: true },
            programmeCode: { type: "string", nullable: true },
            admissionDate: { type: "string", format: "date" },
            status: { type: "string", enum: ["active", "inactive"] },
            createdAt: { type: "string" },
            balanceCents: { type: "integer", description: "charges − (non-reversed payments), in cents" },
          },
        },
        StudentListResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Student" } },
            page: { type: "integer" },
            pageSize: { type: "integer" },
            total: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        StatusPatch: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["active", "inactive"], example: "inactive" },
          },
        },
        // ---- Programmes / Departments ---------------------------------------
        ProgrammeRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "BSc Computer Science" },
            level: { type: "string", example: "Undergraduate" },
            isActive: { type: "boolean", default: true },
          },
        },
        DepartmentRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Finance & Operations" },
            isActive: { type: "boolean", default: true },
          },
        },
        Programme: {
          type: "object",
          properties: {
            id: { type: "integer" },
            code: { type: "string", example: "PRG-00101" },
            name: { type: "string" },
            level: { type: "string" },
            isActive: { type: "integer", example: 1 },
            createdAt: { type: "string" },
          },
        },
        Department: {
          type: "object",
          properties: {
            id: { type: "integer" },
            code: { type: "string", example: "DEP-00101" },
            name: { type: "string" },
            isActive: { type: "integer", example: 1 },
            createdAt: { type: "string" },
          },
        },
        // ---- Employees ------------------------------------------------------
        EmployeeRequest: {
          type: "object",
          required: ["firstName", "lastName", "email", "departmentId", "employmentDate"],
          properties: {
            firstName: { type: "string", example: "Grace" },
            lastName: { type: "string", example: "Mabaso" },
            email: { type: "string", format: "email", example: "grace.mabaso@example.edu" },
            phone: { type: "string", example: "" },
            departmentId: { type: "integer", minimum: 1, example: 1 },
            jobTitle: { type: "string", example: "Registrar Officer" },
            employmentDate: { type: "string", format: "date", example: "2024-05-01" },
            status: { type: "string", enum: ["active", "inactive"], default: "active" },
            employeeNumber: { type: "string", example: "EMP-01004", description: "Optional manual override; auto-generated when omitted" },
          },
        },
        Employee: {
          type: "object",
          properties: {
            id: { type: "integer" },
            employeeNumber: { type: "string", example: "EMP-01001" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            departmentId: { type: "integer", nullable: true },
            departmentName: { type: "string", nullable: true },
            departmentCode: { type: "string", nullable: true },
            jobTitle: { type: "string" },
            employmentDate: { type: "string", format: "date" },
            status: { type: "string", enum: ["active", "inactive"] },
            createdAt: { type: "string" },
          },
        },
        EmployeeListResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Employee" } },
            page: { type: "integer" },
            pageSize: { type: "integer" },
            total: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        // ---- Finance ---------------------------------------------------------
        ChargeRequest: {
          type: "object",
          required: ["studentId", "description", "amount", "chargeDate"],
          properties: {
            studentId: { type: "integer", minimum: 1, example: 1 },
            category: { type: "string", enum: ["tuition", "accommodation", "library", "registration", "other"], default: "tuition" },
            description: { type: "string", example: "Semester tuition fee" },
            amount: { type: "string", example: "1250.50", description: "Decimal string with up to 2 places" },
            chargeDate: { type: "string", format: "date", example: "2026-02-03" },
          },
        },
        Charge: {
          type: "object",
          properties: {
            id: { type: "integer" },
            chargeNumber: { type: "string", example: "CHR-00001" },
            studentId: { type: "integer" },
            studentNumber: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            category: { type: "string" },
            description: { type: "string" },
            amountCents: { type: "integer" },
            chargeDate: { type: "string", format: "date" },
            allocatedCents: { type: "integer" },
            openCents: { type: "integer" },
          },
        },
        ChargeListResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Charge" } },
            page: { type: "integer" },
            pageSize: { type: "integer" },
            total: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        PaymentRequest: {
          type: "object",
          required: ["studentId", "amount", "paymentDate"],
          properties: {
            studentId: { type: "integer", minimum: 1, example: 1 },
            amount: { type: "string", example: "350.00", description: "Decimal string with up to 2 places" },
            method: { type: "string", enum: ["cash", "bank_transfer", "card", "mobile_money", "cheque"], default: "cash" },
            reference: { type: "string", example: "TRX-448812" },
            note: { type: "string", example: "" },
            paymentDate: { type: "string", format: "date", example: "2026-02-05" },
            allocations: {
              type: "array",
              description: "Optional explicit allocation; omitted => FIFO auto-allocation across open charges",
              items: {
                type: "object",
                required: ["chargeId", "amount"],
                properties: {
                  chargeId: { type: "integer", minimum: 1 },
                  amount: { type: "string", example: "350.00" },
                },
              },
            },
          },
        },
        Payment: {
          type: "object",
          properties: {
            id: { type: "integer" },
            paymentNumber: { type: "string", example: "PAY-00001" },
            studentId: { type: "integer" },
            studentNumber: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            amountCents: { type: "integer" },
            method: { type: "string" },
            reference: { type: "string" },
            note: { type: "string" },
            paymentDate: { type: "string", format: "date" },
            isReversed: { type: "integer", example: 0 },
            reversalReason: { type: "string", nullable: true },
            reversedAt: { type: "string", nullable: true },
          },
        },
        PaymentListResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Payment" } },
            page: { type: "integer" },
            pageSize: { type: "integer" },
            total: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
        ReversalRequest: {
          type: "object",
          required: ["reason"],
          properties: {
            reason: { type: "string", minLength: 5, example: "Bank statement error — duplicate capture" },
          },
        },
        StudentFinanceProfile: {
          type: "object",
          properties: {
            student: { $ref: "#/components/schemas/Student" },
            charges: { type: "array", items: { $ref: "#/components/schemas/Charge" } },
            payments: { type: "array", items: { $ref: "#/components/schemas/Payment" } },
            totals: {
              type: "object",
              properties: {
                chargesCents: { type: "integer" },
                paymentsCents: { type: "integer" },
                outstandingCents: { type: "integer" },
              },
            },
          },
        },
        // ---- Users / Settings -------------------------------------------------
        CreateUserRequest: {
          type: "object",
          required: ["fullName", "email", "password", "roleCode"],
          properties: {
            fullName: { type: "string", example: "Rajesh Pillay" },
            email: { type: "string", format: "email", example: "rajesh.pillay@example.edu" },
            password: { type: "string", minLength: 8, example: "Fin0fficer2026!", description: "Min 8 chars, must contain a letter and a digit" },
            roleCode: {
              type: "string",
              enum: ["administrator", "finance_officer", "student_affairs_officer", "hr_officer"],
              example: "finance_officer",
            },
          },
        },
        UpdateUserRequest: {
          type: "object",
          properties: {
            fullName: { type: "string", example: "Rajesh Pillay" },
            roleCode: {
              type: "string",
              enum: ["administrator", "finance_officer", "student_affairs_officer", "hr_officer"],
            },
            isActive: { type: "boolean", example: true },
            password: { type: "string", minLength: 8, description: "Optional password reset" },
          },
        },
        AppUser: {
          type: "object",
          properties: {
            id: { type: "integer" },
            email: { type: "string" },
            fullName: { type: "string" },
            roleCode: { type: "string" },
            roleName: { type: "string" },
            isActive: { type: "integer", example: 1 },
            createdAt: { type: "string" },
          },
        },
        SettingsUpdateRequest: {
          type: "object",
          required: ["keys"],
          properties: {
            keys: {
              type: "object",
              description: "Key/value pairs. Allowed keys: org_name, currency, currency_minor_units",
              additionalProperties: { type: "string" },
              example: { org_name: "UniCore University", currency: "ZAR", currency_minor_units: "2" },
            },
          },
        },
        ImportResult: {
          type: "object",
          properties: {
            entity: { type: "string", example: "students" },
            dryRun: { type: "boolean" },
            inserted: { type: "integer" },
            updated: { type: "integer" },
            skipped: { type: "integer" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: { row: { type: "integer" }, message: { type: "string" } },
              },
            },
          },
        },
      },
    },
    paths: {
      // === Auth ================================================================
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Log in a user",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
          responses: {
            200: created("Successful login", "LoginResponse"),
            401: { description: "Invalid credentials", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Log out (stateless; client discards the token)",
          responses: { 200: { description: "OK" } },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get the logged-in user profile",
          security: authed,
          responses: {
            200: created("Current authenticated user", "UserSession"),
            401: { description: "Not authenticated", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/auth/change-password": {
        post: {
          tags: ["Auth"],
          summary: "Change the logged-in user's password",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordRequest" } } } },
          responses: {
            200: ok("Password updated"),
            400: { description: "Current password incorrect / validation failed", content: { "application/json": { schema: badRequest } } },
            401: { description: "Not authenticated", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      // === Dashboard ============================================================
      "/api/dashboard": {
        get: {
          tags: ["Dashboard"],
          summary: "Dashboard summary (all figures computed live from SQLite)",
          security: authed,
          responses: {
            200: {
              description: "Dashboard summary data",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      totals: {
                        type: "object",
                        properties: {
                          activeStudents: { type: "integer" },
                          totalStudents: { type: "integer" },
                          activeEmployees: { type: "integer" },
                          paymentsReceivedCents: { type: "integer" },
                          outstandingCents: { type: "integer" },
                        },
                      },
                      recentStudents: { type: "array", items: { type: "object" } },
                      recentPayments: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // === Students =============================================================
      "/api/students": {
        get: {
          tags: ["Students"],
          summary: "List students (search, filter, paginate)",
          security: authed,
          parameters: pageQueryParams([
            { in: "query", name: "q", schema: { type: "string" }, description: "Search name, email or student number" },
            { in: "query", name: "programmeId", schema: { type: "integer" }, description: "Filter by programme" },
            { in: "query", name: "status", schema: { type: "string", enum: ["active", "inactive"] } },
          ]),
          responses: {
            200: created("Student collection", "StudentListResponse"),
            401: { description: "Not authenticated", content: { "application/json": { schema: badRequest } } },
          },
        },
        post: {
          tags: ["Students"],
          summary: "Create a student",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StudentRequest" } } } },
          responses: {
            201: created("Student created (balanceCents 0)", "Student"),
            400: { description: "Validation failed", content: { "application/json": { schema: badRequest } } },
            409: { description: "Duplicate email or unknown programme", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/students/{id}": {
        get: {
          tags: ["Students"],
          summary: "Get a student by ID",
          security: authed,
          parameters: [pathParam("id")],
          responses: {
            200: created("Student record", "Student"),
            404: { description: "Student not found", content: { "application/json": { schema: badRequest } } },
          },
        },
        put: {
          tags: ["Students"],
          summary: "Update a student (full record update)",
          security: authed,
          parameters: [pathParam("id")],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StudentRequest" } } } },
          responses: {
            200: created("Student updated", "Student"),
            400: { description: "Validation failed", content: { "application/json": { schema: badRequest } } },
            409: { description: "Duplicate email or unknown programme", content: { "application/json": { schema: badRequest } } },
            404: { description: "Student not found", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/students/{id}/profile": {
        get: {
          tags: ["Students"],
          summary: "Student profile with charges, payments and outstanding totals",
          security: authed,
          parameters: [pathParam("id")],
          responses: {
            200: created("Student profile", "StudentFinanceProfile"),
            404: { description: "Student not found", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/students/{id}/status": {
        patch: {
          tags: ["Students"],
          summary: "Deactivate or reactivate a student (history is preserved)",
          security: authed,
          parameters: [pathParam("id")],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StatusPatch" } } } },
          responses: {
            200: created("Status updated", "Student"),
            400: { description: "Invalid status value", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      // === Programmes ============================================================
      "/api/programmes": {
        get: {
          tags: ["Programmes"],
          summary: "List programmes (active only unless all=1)",
          security: authed,
          parameters: [{ in: "query", name: "all", schema: { type: "string", enum: ["1"] }, description: "1 = include inactive" }],
          responses: { 200: created("Programme list", "Programme") },
        },
        post: {
          tags: ["Programmes"],
          summary: "Create a programme (code auto-generated)",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProgrammeRequest" } } } },
          responses: {
            201: created("Programme created", "Programme"),
            409: { description: "Duplicate code", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/programmes/{id}": {
        put: {
          tags: ["Programmes"],
          summary: "Update a programme",
          security: authed,
          parameters: [pathParam("id")],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProgrammeRequest" } } } },
          responses: {
            200: created("Programme updated", "Programme"),
            404: { description: "Programme not found", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      // === Departments ============================================================
      "/api/departments": {
        get: {
          tags: ["Departments"],
          summary: "List departments (active only unless all=1)",
          security: authed,
          parameters: [{ in: "query", name: "all", schema: { type: "string", enum: ["1"] }, description: "1 = include inactive" }],
          responses: { 200: created("Department list", "Department") },
        },
        post: {
          tags: ["Departments"],
          summary: "Create a department (code auto-generated)",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/DepartmentRequest" } } } },
          responses: {
            201: created("Department created", "Department"),
            409: { description: "Duplicate code", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/departments/{id}": {
        put: {
          tags: ["Departments"],
          summary: "Update a department",
          security: authed,
          parameters: [pathParam("id")],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/DepartmentRequest" } } } },
          responses: {
            200: created("Department updated", "Department"),
            404: { description: "Department not found", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      // === Employees ==============================================================
      "/api/employees": {
        get: {
          tags: ["Employees"],
          summary: "List employees (search, filter, paginate)",
          security: authed,
          parameters: pageQueryParams([
            { in: "query", name: "q", schema: { type: "string" }, description: "Search name, email or employee number" },
            { in: "query", name: "departmentId", schema: { type: "integer" }, description: "Filter by department" },
            { in: "query", name: "status", schema: { type: "string", enum: ["active", "inactive"] } },
          ]),
          responses: { 200: created("Employee collection", "EmployeeListResponse") },
        },
        post: {
          tags: ["Employees"],
          summary: "Create an employee",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/EmployeeRequest" } } } },
          responses: {
            201: created("Employee created", "Employee"),
            400: { description: "Validation failed", content: { "application/json": { schema: badRequest } } },
            409: { description: "Duplicate email or unknown department", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/employees/{id}": {
        get: {
          tags: ["Employees"],
          summary: "Get an employee by ID",
          security: authed,
          parameters: [pathParam("id")],
          responses: {
            200: created("Employee record", "Employee"),
            404: { description: "Employee not found", content: { "application/json": { schema: badRequest } } },
          },
        },
        put: {
          tags: ["Employees"],
          summary: "Update an employee (full record update)",
          security: authed,
          parameters: [pathParam("id")],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/EmployeeRequest" } } } },
          responses: {
            200: created("Employee updated", "Employee"),
            409: { description: "Duplicate email or unknown department", content: { "application/json": { schema: badRequest } } },
            404: { description: "Employee not found", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/employees/{id}/status": {
        patch: {
          tags: ["Employees"],
          summary: "Deactivate or reactivate an employee (history is preserved)",
          security: authed,
          parameters: [pathParam("id")],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StatusPatch" } } } },
          responses: {
            200: created("Status updated", "Employee"),
            400: { description: "Invalid status value", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      // === Finance ================================================================
      "/api/finance/charges": {
        get: {
          tags: ["Finance"],
          summary: "List fee charges with allocated/open amounts",
          security: authed,
          parameters: pageQueryParams([
            { in: "query", name: "q", schema: { type: "string" }, description: "Search charge no., description or student" },
            { in: "query", name: "studentId", schema: { type: "integer" }, description: "Filter by student" },
          ]),
          responses: { 200: created("Charge list", "ChargeListResponse") },
        },
        post: {
          tags: ["Finance"],
          summary: "Create a fee charge (immutable once recorded)",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ChargeRequest" } } } },
          responses: {
            201: created("Charge created", "Charge"),
            400: { description: "Validation failed or unknown/inactive student", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/finance/payments": {
        get: {
          tags: ["Finance"],
          summary: "List payments (including reversed, for the audit trail)",
          security: authed,
          parameters: pageQueryParams([
            { in: "query", name: "q", schema: { type: "string" }, description: "Search payment no., reference or student" },
            { in: "query", name: "studentId", schema: { type: "integer" }, description: "Filter by student" },
          ]),
          responses: { 200: created("Payment list", "PaymentListResponse") },
        },
        post: {
          tags: ["Finance"],
          summary: "Record a payment (auto-allocated FIFO unless explicit allocations given)",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentRequest" } } } },
          responses: {
            201: created("Payment created", "Payment"),
            400: { description: "Validation failed, unknown/inactive student or bad allocations", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/finance/payments/{id}/reverse": {
        post: {
          tags: ["Finance"],
          summary: "Reverse a payment (never deleted; reason is required for the audit trail)",
          security: authed,
          parameters: [pathParam("id")],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ReversalRequest" } } } },
          responses: {
            200: created("Payment reversed", "Payment"),
            404: { description: "Payment not found", content: { "application/json": { schema: badRequest } } },
            409: { description: "Payment already reversed", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/finance/students/{id}/profile": {
        get: {
          tags: ["Finance"],
          summary: "Student statement (charges, payments, outstanding) readable by finance officers",
          security: authed,
          parameters: [pathParam("id")],
          responses: {
            200: created("Student profile", "StudentFinanceProfile"),
            404: { description: "Student not found", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      // === Users ==================================================================
      "/api/users": {
        get: {
          tags: ["Users"],
          summary: "List users (administrator only)",
          security: authed,
          responses: { 200: created("User list", "AppUser") },
        },
        post: {
          tags: ["Users"],
          summary: "Create a user (administrator only)",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" } } } },
          responses: {
            201: created("User created", "AppUser"),
            409: { description: "Email already used", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/users/{id}": {
        put: {
          tags: ["Users"],
          summary: "Update a user: name, role, activation or password reset (administrator only)",
          security: authed,
          parameters: [pathParam("id")],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateUserRequest" } } } },
          responses: {
            200: created("User updated", "AppUser"),
            400: { description: "Cannot deactivate self / remove own admin role", content: { "application/json": { schema: badRequest } } },
            404: { description: "User not found", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      // === Settings ================================================================
      "/api/settings": {
        get: {
          tags: ["Settings"],
          summary: "Get system settings (live records from the settings table)",
          security: authed,
          responses: {
            200: {
              description: "Settings key/value map",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: { type: "string" },
                    example: { org_name: "UniCore University", currency: "ZAR", currency_minor_units: "2" },
                  },
                },
              },
            },
          },
        },
        put: {
          tags: ["Settings"],
          summary: "Update settings (upsert; unknown keys are ignored)",
          security: authed,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/SettingsUpdateRequest" } } } },
          responses: { 200: ok("Updated settings returned") },
        },
      },
      // === Import / export ==========================================================
      "/api/import/{entity}": {
        post: {
          tags: ["Import/Export"],
          summary: "Import CSV into SQLite (validated in a transaction; use dryRun to preview)",
          security: authed,
          parameters: [
            {
              in: "path",
              name: "entity",
              required: true,
              schema: { type: "string", enum: ["students", "programmes", "departments", "employees", "fee_charges", "payments"] },
            },
            { in: "query", name: "dryRun", schema: { type: "string", enum: ["true"] }, description: "Validate without writing" },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["csv"],
                  properties: {
                    csv: { type: "string", description: "Raw CSV contents including the header row" },
                    dryRun: { type: "boolean", description: "true = validate only, nothing is written", example: false },
                  },
                },
                example: {
                  csv: "first_name,last_name,email,programme_id,admission_date,phone\nJane,Doe,jane.doe@example.edu,1,2026-03-01,",
                  dryRun: false,
                },
              },
            },
          },
          responses: {
            200: created("Import result summary", "ImportResult"),
            400: { description: "Unknown entity or invalid CSV", content: { "application/json": { schema: badRequest } } },
          },
        },
      },
      "/api/export/{entity}.csv": {
        get: {
          tags: ["Import/Export"],
          summary: "Export a table from SQLite as CSV",
          security: authed,
          parameters: [
            {
              in: "path",
              name: "entity",
              required: true,
              schema: { type: "string", enum: ["students", "programmes", "departments", "employees", "fee_charges", "payments"] },
            },
          ],
          responses: { 200: { description: "CSV file attachment" } },
        },
      },
      "/api/export/{entity}.json": {
        get: {
          tags: ["Import/Export"],
          summary: "Export a table from SQLite as JSON ({ headers, rows })",
          security: authed,
          parameters: [
            {
              in: "path",
              name: "entity",
              required: true,
              schema: { type: "string", enum: ["students", "programmes", "departments", "employees", "fee_charges", "payments"] },
            },
          ],
          responses: {
            200: {
              description: "JSON export",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      headers: { type: "array", items: { type: "string" } },
                      rows: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
});
