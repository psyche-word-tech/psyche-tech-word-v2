import { relations } from "drizzle-orm/relations";
import { problems, favorites, usersInAuth, userProfiles, essayGradingResults } from "./schema";

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
	usersInAuth: one(usersInAuth, {
		fields: [userProfiles.id],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	userProfiles: many(userProfiles),
	essayGradingResults: many(essayGradingResults),
}));

export const essayGradingResultsRelations = relations(essayGradingResults, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [essayGradingResults.userId],
		references: [usersInAuth.id]
	}),
}));