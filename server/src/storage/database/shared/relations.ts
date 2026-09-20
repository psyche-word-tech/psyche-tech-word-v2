import { relations } from "drizzle-orm/relations";
import { problems, favorites, users, userProfiles, essayGradingResults } from "./schema";

export const favoritesRelations = relations(favorites, ({one}) => ({
	problem: one(problems, {
		fields: [favorites.problemId],
		references: [problems.id]
	}),
}));

export const problemsRelations = relations(problems, ({many}) => ({
	favorites: many(favorites),
}));

export const userProfilesRelations = relations(userProfiles, ({one}) => ({
	users: one(users, {
		fields: [userProfiles.id],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	userProfiles: many(userProfiles),
	essayGradingResults: many(essayGradingResults),
}));

export const essayGradingResultsRelations = relations(essayGradingResults, ({one}) => ({
	users: one(users, {
		fields: [essayGradingResults.userId],
		references: [users.id]
	}),
}));