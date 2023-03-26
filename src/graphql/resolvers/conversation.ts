import { ConversationPopulated, GraphQLContext } from "../../util/types";
import { ApolloError } from "apollo-server-core";
import { Prisma } from "@prisma/client";
import { withFilter } from "graphql-subscriptions";

const resolvers = {
	Query: {
		conversations: async (
			_: any,
			__: any,
			context: GraphQLContext
		): Promise<ConversationPopulated[]> => {
			const { session, prisma } = context;

			if (!session?.user) {
				throw new ApolloError("Not authorized");
			}

			const {
				user: { id: userId },
			} = session;

			try {
				/**
				 * Find all conversations that user is part of
				 */

				const conversations = await prisma.conversation.findMany({
					where: {
						participants: {
							some: {
								userId: {
									equals: userId,
								},
							},
						},
					},
					include: conversationPopulated,
				});

				console.log("backedn", conversations);

				return conversations;
			} catch (error: any) {
				console.log("conversations error", error);
				throw new ApolloError(error?.message);
			}
		},
	},
	Mutation: {
		createConversation: async (
			_: any,
			args: { participantIds: string[] },
			context: GraphQLContext
		): Promise<{ conversationId: string }> => {
			const { participantIds } = args;
			const { session, prisma, pubsub } = context;

			if (!session?.user) {
				throw new ApolloError("Not authorized");
			}

			const {
				user: { id: userId },
			} = session;

			try {
				const conversation = await prisma.conversation.create({
					data: {
						participants: {
							createMany: {
								data: participantIds.map((id) => ({
									userId: id,
									hasSeenLatestMessage: id === userId,
								})),
							},
						},
					},
					include: conversationPopulated,
				});

				pubsub.publish("CONVERSATION_CREATED", {
					conversationCreated: conversation,
				});

				return {
					conversationId: conversation.id,
				};
			} catch (error) {
				console.error("createConversation error", error);
				throw new ApolloError("Error creating conversation");
			}
		},
	},
	Subscription: {
		conversationCreated: {
			// subscribe: (_: any, __: any, context: GraphQLContext) => {
			// 	const { pubsub } = context;

			// 	return pubsub.asyncIterator(["CONVERSATION_CREATED"]);
			// },
			subscribe: withFilter(
				(_: any, __: any, context: GraphQLContext) => {
					const { pubsub } = context;

					return pubsub.asyncIterator(["CONVERSATION_CREATED"]);
				},
				(
					payload: ConversationCreatedSubscriptionPayload,
					_,
					context: GraphQLContext
				) => {
					const { session } = context;
					const {
						conversationCreated: { participants },
					} = payload;

					const userIsParticipant = !!participants.find(
						(p) => p.userId === session?.user?.id
					);

					return userIsParticipant;
				}
			),
		},
	},
};

export interface ConversationCreatedSubscriptionPayload {
	conversationCreated: ConversationPopulated;
}

export const participantPopulated =
	Prisma.validator<Prisma.ConversationParticipantInclude>()({
		user: {
			select: {
				id: true,
				username: true,
			},
		},
	});

export const conversationPopulated =
	Prisma.validator<Prisma.ConversationInclude>()({
		participants: {
			include: participantPopulated,
		},
		latestMessage: {
			include: {
				sender: {
					select: {
						id: true,
						username: true,
					},
				},
			},
		},
	});

export default resolvers;
