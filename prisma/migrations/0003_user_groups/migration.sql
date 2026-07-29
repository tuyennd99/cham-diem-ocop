CREATE TABLE "user_groups" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_group_members" (
  "userGroupId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("userGroupId", "userId")
);

CREATE TABLE "task_user_groups" (
  "taskId" INTEGER NOT NULL,
  "userGroupId" INTEGER NOT NULL,
  CONSTRAINT "task_user_groups_pkey" PRIMARY KEY ("taskId", "userGroupId")
);

CREATE UNIQUE INDEX "user_groups_name_key" ON "user_groups"("name");
CREATE INDEX "user_group_members_userId_idx" ON "user_group_members"("userId");
CREATE INDEX "task_user_groups_userGroupId_idx" ON "task_user_groups"("userGroupId");

ALTER TABLE "user_group_members"
  ADD CONSTRAINT "user_group_members_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "user_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_group_members"
  ADD CONSTRAINT "user_group_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_user_groups"
  ADD CONSTRAINT "task_user_groups_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_user_groups"
  ADD CONSTRAINT "task_user_groups_userGroupId_fkey"
  FOREIGN KEY ("userGroupId") REFERENCES "user_groups"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
