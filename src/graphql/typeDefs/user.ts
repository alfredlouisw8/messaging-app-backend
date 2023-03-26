import { gql } from "apollo-server-core";

const typeDefs = gql`
	type User {
		id: String
		username: String
		email: String
		emailVerification: Boolean
		image: String
		name: String
	}

	type SearchedUser {
		id: String
		username: String
	}

	type Query {
		searchUsers(username: String): [SearchedUser]
	}

	type Mutation {
		createUsername(username: String): CreateUsernameResponse
	}

	type CreateUsernameResponse {
		success: Boolean
		error: String
	}
`;

export default typeDefs;
