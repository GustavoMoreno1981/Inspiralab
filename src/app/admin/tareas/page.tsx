import { Suspense } from "react";
import { TasksBoard } from "@/components/admin/TasksBoard";

export default function AdminTasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksBoard />
    </Suspense>
  );
}
