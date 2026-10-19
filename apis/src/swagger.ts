import swaggerJsdoc from "swagger-jsdoc";
import { config } from "./config.js";

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "UniCore API",
      version: "1.0.0",
      description:
        "REST API for the UniCore university management system. Includes authentication, students, finance, HR, and import/export workflows.",
    },
    servers: [{ url: `http://localhost:${config.port}`, description: "Local development server" }],
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
      { name: "Import", description: "CSV import and export" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "admin@example.com" },
            password: { type: "string", example: "ChangeMe2026!" },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 8 },
          },
        },
        StudentRequest: {
          type: "object",
          required: ["firstName", "lastName", "email", "programmeId", "admissionDate"],
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string", nullable: true },
            programmeId: { type: "integer", minimum: 1 },
            admissionDate: { type: "string", format: "date" },
            status: { type: "string", enum: ["active", "inactive"], default: "active" },
            studentNumber: { type: "string", nullable: true },
          },
        },
        ChargeRequest: {
          type: "object",
          required: ["studentId", "description", "amount", "chargeDate"],
          properties: {
            studentId: { type: "integer", minimum: 1 },
            category: { type: "string", enum: ["tuition", "accommodation", "library", "registration", "other"] },
            description: { type: "string" },
            amount: { type: "string", example: "1250.50" },
            chargeDate: { type: "string", format: "date" },
          },
        },
        PaymentRequest: {
          type: "object",
          required: ["studentId", "amount", "paymentDate"],
          properties: {
            studentId: { type: "integer", minimum: 1 },
            amount: { type: "string", example: "350.00" },
            method: { type: "string", enum: ["cash", "bank_transfer", "card", "mobile_money", "cheque"] },
            reference: { type: "string", nullable: true },
            note: { type: "string", nullable: true },
            paymentDate: { type: "string", format: "date" },
            allocations: {
              type: "array",
              items: {
                type: "object",
                required: ["chargeId", "amount"],
                properties: {
                  chargeId: { type: "integer", minimum: 1 },
                  amount: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    paths: {
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Log in a user",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
          responses: {
            200: { description: "Successful login" },
            401: { description: "Invalid credentials" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get the logged-in user profile",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Current authenticated user" } },
        },
      },
      "/api/auth/change-password": {
        post: {
          tags: ["Auth"],
          summary: "Change the logged-in user's password",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ChangePasswordRequest" } } },
          },
          responses: { 200: { description: "Password updated" } },
        },
      },
      "/api/dashboard": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard summary",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Dashboard summary data" } },
        },
      },
      "/api/students": {
        get: {
          tags: ["Students"],
          summary: "List students",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Student collection" } },
        },
        post: {
          tags: ["Students"],
          summary: "Create a student",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StudentRequest" } } } },
          responses: { 201: { description: "Student created" } },
        },
      },
      "/api/students/{id}": {
        get: {
          tags: ["Students"],
          summary: "Get a student by ID",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
          responses: { 200: { description: "Student record" } },
        },
        put: {
          tags: ["Students"],
          summary: "Update a student",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/StudentRequest" } } } },
          responses: { 200: { description: "Student updated" } },
        },
      },
      "/api/finance/charges": {
        get: {
          tags: ["Finance"],
          summary: "List fee charges",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Charge list" } },
        },
        post: {
          tags: ["Finance"],
          summary: "Create a fee charge",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ChargeRequest" } } } },
          responses: { 201: { description: "Charge created" } },
        },
      },
      "/api/finance/payments": {
        get: {
          tags: ["Finance"],
          summary: "List payments",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Payment list" } },
        },
        post: {
          tags: ["Finance"],
          summary: "Create a payment",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentRequest" } } } },
          responses: { 201: { description: "Payment created" } },
        },
      },
      "/api/finance/payments/{id}/reverse": {
        post: {
          tags: ["Finance"],
          summary: "Reverse a payment",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["reason"], properties: { reason: { type: "string" } } } } },
          },
          responses: { 200: { description: "Payment reversed" } },
        },
      },
      "/api/employees": {
        get: {
          tags: ["Employees"],
          summary: "List employees",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Employee collection" } },
        },
      },
      "/api/users": {
        get: {
          tags: ["Users"],
          summary: "List users",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "User list" } },
        },
      },
      "/api/settings": {
        get: {
          tags: ["Settings"],
          summary: "Get system settings",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Settings" } },
        },
      },
      "/api/import/{entity}": {
        post: {
          tags: ["Import"],
          summary: "Import CSV data",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "entity", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["csv"], properties: { csv: { type: "string" }, dryRun: { type: "boolean" } } } } },
          },
          responses: { 200: { description: "Import result" } },
        },
      },
    },
  },
  apis: [],
});
