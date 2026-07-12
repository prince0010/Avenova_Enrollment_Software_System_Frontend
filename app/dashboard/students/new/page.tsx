import { StudentCreateWizard } from "@/components/student-create/student-create-wizard";

export default function NewStudentPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">Add student</h1>
      <StudentCreateWizard />
    </div>
  );
}
