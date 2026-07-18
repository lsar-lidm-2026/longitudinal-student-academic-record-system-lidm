import { Elysia, t } from "elysia";
import * as service from "./semester-record.service";
import { success } from "../../common/response";
import { requireAuth } from "../../middleware/auth";
import { requireHomeroomAccess } from "../../middleware/homeroom";

export const semesterRecordController = new Elysia({ prefix: "/students" })
  .guard({}, (app) =>
    app
      .use(requireAuth)
      .use(requireHomeroomAccess)
      .post(
        "/:id/semester-records",
        async ({ params, body, user }) => {
          const data = await service.create({
            ...body,
            studentId: params.id,
            createdById: user.userId,
          });
          return success(data);
        },
        {
          body: t.Object({
            academicYearId: t.String(),
            semester: t.Number({ minimum: 1, maximum: 2 }),
          }),
        }
      )
      .get("/:id/semester-records", async ({ params }) => {
        const data = await service.listByStudent(params.id);
        return success(data);
      })
  );
