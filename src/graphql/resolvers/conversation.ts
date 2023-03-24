import { GraphQLContext } from "../../util/types";

const resolvers = {
	Mutation: {
		createConversation: async (
			_: any,
			args: { participantIds: string[] },
			context: GraphQLContext
		) => {
			const { participantIds } = args;
		},
	},
};

export default resolvers;
