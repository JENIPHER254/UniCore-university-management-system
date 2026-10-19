import { Router } from "express";
import { authenticate, permitModule } from "../auth/middleware.js";
import { signToken } from "../config.js";
import { getDb } from "../db/index.js";
import { verifyPassword } from "../auth/password.js";
import { badRequest, unauthorized } from "../lib/errors.js";
import { validateBody } from "../validation/middleware.js";
import {
  changePasswordSchema,
  chargeSchema,
  createUserSchema,
  departmentSchema,
  employeeSchema,
  employeeUpdateSchema,
  loginSchema,
  paymentSchema,
  programmeSchema,
  reversalSchema,
  settingsSchema,
  studentSchema,
  studentUpdateSchema,
  updateUserSchema,
} from "../validation/schemas.js";
import * as usersSrv from "../services/users.service.js";
import * as studentsSrv from "../services/students.service.js";
import * as refSrv from "../services/reference.service.js";
import * as empSrv from "../services/employees.service.js";
import * as finSrv from "../services/finance.service.js";
import * as dashSrv from "../services/dashboard.service.js";
import * as settingsSrv from "../services/settings.service.js";
import * as importSrv from "../services/import.service.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { toCsv } from "../lib/csv.js";
import { writeAudit } from "../lib/audit.js";
import type { z } from "zod";
import type { RequestHandler } from "express";

const u = (req: AuthedRequest) => req.user!;

/** Middleware that validates the :id route parameter, then continues. */
const requireValidId: RequestHandler = (req, _res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    next(badRequest("Invalid id"));
    return;
  }
  next();
};

// ---- Auth -------------------------------------------------------------------
export const authRoutes = Router();

authRoutes.post("/login", validateBody(loginSchema), (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof loginSchema>;
    const db = getDb();
    const row = db
      .prepare("SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.code = u.role_code WHERE u.email = ?")
      .get(body.email.toLowerCase()) as
      | { id: number; email: string; full_name: string; password_hash: string; role_code: string; role_name: string; is_active: number }
      | undefined;
    if (!row || !verifyPassword(body.password, row.password_hash)) {
      throw unauthorized("Incorrect email or password");
    }
    if (row.is_active !== 1) throw unauthorized("This account has been deactivated");
    const token = signToken({ sub: row.id, role: row.role_code, email: row.email });
    writeAudit(db, { userId: row.id, action: "auth.login", entityType: "user", entityId: row.id });
    res.json({
      token,
      user: { id: row.id, email: row.email, fullName: row.full_name, roleCode: row.role_code, roleName: row.role_name },
    });
  } catch (err) {
    next(err);
  }
});

authRoutes.post("/logout", (_req, res) => res.json({ ok: true }));

authRoutes.get("/me", authenticate, (req, res) => {
  res.json(u(req as AuthedRequest));
});

authRoutes.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  (req, res, next) => {
    try {
      usersSrv.changePassword(u(req as AuthedRequest).id, req.body as never);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// ---- Dashboard --------------------------------------------------------------
export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate, permitModule("dashboard"));
dashboardRoutes.get("/", (_req, res) => res.json(dashSrv.getDashboard()));

// ---- Students ---------------------------------------------------------------
export const studentRoutes = Router();
studentRoutes.use(authenticate, permitModule("students"));

studentRoutes.get("/", (req, res, next) => {
  try {
    const q = req.query as { q?: string; programmeId?: string; status?: string; page?: string; pageSize?: string };
    res.json(
      studentsSrv.listStudents({
        q: q.q || undefined,
        programmeId: q.programmeId ? Number(q.programmeId) : undefined,
        status: q.status === "active" || q.status === "inactive" ? q.status : undefined,
        page: q.page ? Number(q.page) : undefined,
        pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      })
    );
  } catch (err) {
    next(err);
  }
});

studentRoutes.get("/:id", requireValidId, (req, res, next) => {
  try {
    res.json(studentsSrv.getStudent(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

studentRoutes.get("/:id/profile", requireValidId, (req, res, next) => {
  try {
    res.json(studentsSrv.getStudentProfile(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

studentRoutes.post(
  "/",
  validateBody(studentSchema),
  (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof studentSchema>;
      const { studentNumber, ...rest } = body;
      res.status(201).json(studentsSrv.createStudent(rest, u(req as AuthedRequest).id, studentNumber));
    } catch (err) {
      next(err);
    }
  }
);

studentRoutes.put(
  "/:id",
  requireValidId,
  validateBody(studentUpdateSchema),
  (req, res, next) => {
    try {
      res.json(studentsSrv.updateStudent(Number(req.params.id), req.body as never, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

studentRoutes.patch(
  "/:id/status",
  requireValidId,
  (req, res, next) => {
    try {
      const { status } = req.body as { status?: string };
      if (status !== "active" && status !== "inactive") throw badRequest("status must be 'active' or 'inactive'");
      res.json(studentsSrv.setStudentStatus(Number(req.params.id), status, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

// ---- Programmes -------------------------------------------------------------
export const programmeRoutes = Router();
programmeRoutes.use(authenticate, permitModule("programmes"));

programmeRoutes.get("/", (req, res) => {
  res.json(refSrv.listProgrammes(req.query.all === "1"));
});

programmeRoutes.post(
  "/",
  validateBody(programmeSchema),
  (req, res, next) => {
    try {
      res.status(201).json(refSrv.createProgramme(req.body as never, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

programmeRoutes.put(
  "/:id",
  requireValidId,
  validateBody(programmeSchema),
  (req, res, next) => {
    try {
      res.json(refSrv.updateProgramme(Number(req.params.id), req.body as never, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

// ---- Departments ------------------------------------------------------------
export const departmentRoutes = Router();
departmentRoutes.use(authenticate, permitModule("hr"));

departmentRoutes.get("/", (req, res) => {
  res.json(refSrv.listDepartments(req.query.all === "1"));
});

departmentRoutes.post(
  "/",
  validateBody(departmentSchema),
  (req, res, next) => {
    try {
      res.status(201).json(refSrv.createDepartment(req.body as never, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

departmentRoutes.put(
  "/:id",
  requireValidId,
  validateBody(departmentSchema),
  (req, res, next) => {
    try {
      res.json(refSrv.updateDepartment(Number(req.params.id), req.body as never, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

// ---- Employees --------------------------------------------------------------
export const employeeRoutes = Router();
employeeRoutes.use(authenticate, permitModule("hr"));

employeeRoutes.get("/", (req, res, next) => {
  try {
    const q = req.query as { q?: string; departmentId?: string; status?: string; page?: string; pageSize?: string };
    res.json(
      empSrv.listEmployees({
        q: q.q || undefined,
        departmentId: q.departmentId ? Number(q.departmentId) : undefined,
        status: q.status === "active" || q.status === "inactive" ? q.status : undefined,
        page: q.page ? Number(q.page) : undefined,
        pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      })
    );
  } catch (err) {
    next(err);
  }
});

employeeRoutes.get("/:id", requireValidId, (req, res, next) => {
  try {
    res.json(empSrv.getEmployee(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

employeeRoutes.post(
  "/",
  validateBody(employeeSchema),
  (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof employeeSchema>;
      const { employeeNumber, ...rest } = body;
      res.status(201).json(empSrv.createEmployee(rest, u(req as AuthedRequest).id, employeeNumber));
    } catch (err) {
      next(err);
    }
  }
);

employeeRoutes.put(
  "/:id",
  requireValidId,
  validateBody(employeeUpdateSchema),
  (req, res, next) => {
    try {
      res.json(empSrv.updateEmployee(Number(req.params.id), req.body as never, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

employeeRoutes.patch(
  "/:id/status",
  requireValidId,
  (req, res, next) => {
    try {
      const { status } = req.body as { status?: string };
      if (status !== "active" && status !== "inactive") throw badRequest("status must be 'active' or 'inactive'");
      res.json(empSrv.setEmployeeStatus(Number(req.params.id), status, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

// ---- Finance ----------------------------------------------------------------
export const financeRoutes = Router();
financeRoutes.use(authenticate, permitModule("finance"));

financeRoutes.post("/charges", validateBody(chargeSchema), (req, res, next) => {
  try {
    res.status(201).json(finSrv.createCharge(req.body as never, u(req as AuthedRequest).id));
  } catch (err) {
    next(err);
  }
});

financeRoutes.get("/charges", (req, res, next) => {
  try {
    const q = req.query as { q?: string; studentId?: string; page?: string; pageSize?: string };
    res.json(
      finSrv.listCharges({
        q: q.q || undefined,
        studentId: q.studentId ? Number(q.studentId) : undefined,
        page: q.page ? Number(q.page) : undefined,
        pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      })
    );
  } catch (err) {
    next(err);
  }
});

financeRoutes.post("/payments", validateBody(paymentSchema), (req, res, next) => {
  try {
    res.status(201).json(finSrv.createPayment(req.body as never, u(req as AuthedRequest).id));
  } catch (err) {
    next(err);
  }
});

financeRoutes.get("/payments", (req, res, next) => {
  try {
    const q = req.query as { q?: string; studentId?: string; page?: string; pageSize?: string };
    res.json(
      finSrv.listPayments({
        q: q.q || undefined,
        studentId: q.studentId ? Number(q.studentId) : undefined,
        page: q.page ? Number(q.page) : undefined,
        pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      })
    );
  } catch (err) {
    next(err);
  }
});

financeRoutes.post(
  "/payments/:id/reverse",
  validateBody(reversalSchema),
  (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid payment id");
      res.json(finSrv.reversePayment(id, req.body as unknown as z.infer<typeof reversalSchema>, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

financeRoutes.get("/students/:id/profile", (req, res, next) => {
  try {
    // Finance officers can read a student's statement without student-module rights.
    res.json(studentsSrv.getStudentProfile(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

// ---- Users (administrator only) ----------------------------------------------
export const userRoutes = Router();
userRoutes.use(authenticate, permitModule("users"));

userRoutes.get("/", (_req, res) => res.json(usersSrv.listUsers()));

userRoutes.post("/", validateBody(createUserSchema), (req, res, next) => {
  try {
    res.status(201).json(usersSrv.createUser(req.body as never, u(req as AuthedRequest).id));
  } catch (err) {
    next(err);
  }
});

userRoutes.put(
  "/:id",
  requireValidId,
  validateBody(updateUserSchema),
  (req, res, next) => {
    try {
      res.json(usersSrv.updateUser(Number(req.params.id), req.body as never, u(req as AuthedRequest).id));
    } catch (err) {
      next(err);
    }
  }
);

// ---- Settings (administrator only) -------------------------------------------
export const settingsRoutes = Router();
settingsRoutes.use(authenticate, permitModule("settings"));

settingsRoutes.get("/", (_req, res) => res.json(settingsSrv.getSettings()));

settingsRoutes.put("/", validateBody(settingsSchema), (req, res, next) => {
  try {
    res.json(settingsSrv.updateSettings((req.body as z.infer<typeof settingsSchema>).keys, u(req as AuthedRequest).id));
  } catch (err) {
    next(err);
  }
});

// ---- Import / export ----------------------------------------------------------
export const importRoutes = Router();
importRoutes.use(authenticate, permitModule("import"));

const IMPORT_ENTITIES: importSrv.ImportEntity[] = [
  "students",
  "programmes",
  "departments",
  "employees",
  "fee_charges",
  "payments",
];

importRoutes.post("/:entity", (req, res, next) => {
  try {
    const entity = req.params.entity as importSrv.ImportEntity;
    if (!IMPORT_ENTITIES.includes(entity)) throw badRequest("Unknown import type");
    const content = typeof req.body?.csv === "string" ? req.body.csv : "";
    if (!content.trim()) throw badRequest("Provide a 'csv' field with the file contents");
    const dryRun = req.body?.dryRun === true || req.query.dryRun === "true";
    res.json(importSrv.importCsv(entity, content, u(req as AuthedRequest).id, dryRun));
  } catch (err) {
    next(err);
  }
});

/** CSV export — permitted roles: admin has all; module owners can export theirs. */
const EXPORT_MODULE: Record<importSrv.ImportEntity, string> = {
  students: "students",
  programmes: "programmes",
  departments: "hr",
  employees: "hr",
  fee_charges: "finance",
  payments: "finance",
};

importRoutes.get("/:entity.json", (req, res, next) => {
  try {
    const entity = req.params.entity as importSrv.ImportEntity;
    if (!IMPORT_ENTITIES.includes(entity)) throw badRequest("Unknown export type");
    res.json(importSrv.exportEntity(entity));
  } catch (err) {
    next(err);
  }
});

importRoutes.get("/:entity.csv", (req, res, next) => {
  try {
    const entity = req.params.entity as importSrv.ImportEntity;
    if (!IMPORT_ENTITIES.includes(entity)) throw badRequest("Unknown export type");
    const { headers, rows } = importSrv.exportEntity(entity);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${entity}.csv"`);
    res.send(toCsv(headers, rows));
  } catch (err) {
    next(err);
  }
});


