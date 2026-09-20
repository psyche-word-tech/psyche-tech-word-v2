import { pgTable, index, uuid, text, varchar, timestamp, serial, foreignKey, unique, check, jsonb, pgPolicy, boolean, integer, doublePrecision } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const problems = pgTable("problems", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionText: text("question_text").notNull(),
	subject: varchar({ length: 50 }),
	answer: text(),
	analysis: text(),
	solution: text(),
	tips: text(),
	imageUrl: text("image_url"),
	imageHash: varchar("image_hash", { length: 64 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	knowledgePoints: text("knowledge_points").default('),
	coreCompetency: text("core_competency").default('),
	difficulty: text().default('),
}, (table) => [
	index("idx_problems_image_hash").using("btree", table.imageHash.asc().nullsLast().op("text_ops")),
	index("idx_problems_question_text").using("gin", sql`to_tsvector('simple'::regconfig, question_text)`),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const favorites = pgTable("favorites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).default('default_user').notNull(),
	problemId: uuid("problem_id"),
	questionText: text("question_text").notNull(),
	subject: varchar({ length: 50 }),
	answer: text(),
	analysis: text(),
	solution: text(),
	tips: text(),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_favorites_problem_id").using("btree", table.problemId.asc().nullsLast().op("uuid_ops")),
	index("idx_favorites_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.problemId],
			foreignColumns: [problems.id],
			name: "favorites_problem_id_fkey"
		}).onDelete("cascade"),
	unique("favorites_user_id_problem_id_key").on(table.userId, table.problemId),
]);

export const submissions = pgTable("submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	studentId: uuid("student_id").notNull(),
	teacherId: uuid("teacher_id"),
	imageUrl: text("image_url").notNull(),
	status: text().default('pending').notNull(),
	grade: text(),
	feedback: text(),
	annotations: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_submissions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_submissions_student").using("btree", table.studentId.asc().nullsLast().op("uuid_ops")),
	index("idx_submissions_teacher").using("btree", table.teacherId.asc().nullsLast().op("uuid_ops")),
	check("submissions_status_check", sql`status = ANY (ARRAY['pending'::text, 'graded'::text])`),
]);

export const userProfiles = pgTable("user_profiles", {
	id: uuid().primaryKey().notNull(),
	role: text().default('student').notNull(),
	nickname: text(),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	irisEnabled: boolean("iris_enabled").default(false),
	userId: integer("user_id"),
	displaySettings: jsonb("display_settings").default({"theme":"system","fontSize":"medium","showExample":true,"showPhonetic":true,"autoPlayAudio":true}),
	notificationSettings: jsonb("notification_settings").default({"pushEnabled":true,"studyReminder":true,"systemNotification":true,"achievementNotification":true}),
}, (table) => [
	index("idx_user_profiles_role").using("btree", table.role.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "user_profiles_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("Users can insert own profile", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = id)`  }),
	pgPolicy("Users can update own profile", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("Users can view own profile", { as: "permissive", for: "select", to: ["public"] }),
	check("user_profiles_role_check", sql`role = ANY (ARRAY['student'::text, 'teacher'::text])`),
]);

export const verificationCodes = pgTable("verification_codes", {
	id: serial().primaryKey().notNull(),
	phone: text().notNull(),
	code: text().notNull(),
	type: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_verification_codes_expires").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_verification_codes_phone").using("btree", table.phone.asc().nullsLast().op("text_ops")),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	phone: text(),
	username: text(),
	password: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_phone_key").on(table.phone),
	unique("users_username_key").on(table.username),
]);

export const dataBackups = pgTable("data_backups", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	backupType: text("backup_type").default('manual').notNull(),
	status: text().default('pending').notNull(),
	fileUrl: text("file_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_data_backups_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
]);

export const irisRecognitionData = pgTable("iris_recognition_data", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	sessionId: uuid("session_id").notNull(),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	emotion: text(),
	focusScore: doublePrecision("focus_score"),
	gazeDirection: text("gaze_direction"),
	difficultyReaction: text("difficulty_reaction"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const userSettings = pgTable("user_settings", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	notificationSettings: jsonb("notification_settings").default({"pushEnabled":true,"studyReminder":true,"systemNotification":true,"achievementNotification":true}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	displaySettings: jsonb("display_settings").default({"theme":"system","fontSize":"medium","showExample":true,"showPhonetic":true,"autoPlayAudio":true}),
}, (table) => [
	index("idx_user_settings_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	unique("user_settings_user_id_key").on(table.userId),
]);

export const essayGradingResults = pgTable("essay_grading_results", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	originalImage: text("original_image").notNull(),
	markedImage: text("marked_image"),
	referenceAnswer: text("reference_answer").notNull(),
	gradingResult: jsonb("grading_result").notNull(),
	maxScore: integer("max_score").default(25),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_essay_grading_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_essay_grading_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "essay_grading_results_user_id_fkey"
		}).onDelete("cascade"),
]);

export const essayGradingTasks = pgTable("essay_grading_tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	imageUrl: text("image_url").notNull(),
	referenceAnswer: text("reference_answer").default('),
	maxScore: integer("max_score").default(15),
	status: text().default('pending').notNull(),
	result: jsonb(),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_essay_grading_tasks_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_essay_grading_tasks_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);
