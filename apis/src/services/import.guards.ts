import type { ProgrammeInput, DepartmentInput } from "./reference.service.js";

export function createProgrammeTypeGuard(input: {
  code: string;
  name: string;
  level?: string;
  isActive?: boolean;
}): ProgrammeInput {
  return {
    code: input.code,
    name: input.name,
    level: input.level ?? "",
    isActive: input.isActive ?? true,
  };
}

export function createDepartmentTypeGuard(input: {
  code: string;
  name: string;
  isActive?: boolean;
}): DepartmentInput {
  return {
    code: input.code,
    name: input.name,
    isActive: input.isActive ?? true,
  };
}
