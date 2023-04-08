import {
	ConversationDeletedSubscriptionPayload,
	ConversationPopulated,
	ConversationUpdatedSubscriptionPayload,
	GraphQLContext,
} from "../../util/types";
import { GraphQLError } from "graphql";
import { Prisma } from "@prisma/client";
import { withFilter } from "graphql-subscriptions";
import { userIsConversationParticipant } from "../../util/functions";

const resolvers = {
	Query: {
		conversations: async (
			_: any,
			__: any,
			context: GraphQLContext
		): Promise<ConversationPopulated[]> => {
			const { session, prisma } = context;

			if (!session?.user) {
				throw new GraphQLError("Not authorized");
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

				return conversations;
			} catch (error: any) {
				console.log("conversations error", error);
				throw new GraphQLError(error?.message);
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
				throw new GraphQLError("Not authorized");
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
				throw new GraphQLError("Error creating conversation");
			}
		},
		markConversationAsRead: async (
			_: any,
			args: { userId: string; conversationId: string },
			context: GraphQLContext
		): Promise<boolean> => {
			const { session, prisma } = context;
			const { userId, conversationId } = args;

			if (!session?.user) {
				throw new GraphQLError("Not authorized");
			}

			try {
				const participant = await prisma.conversationParticipant.findFirst({
					where: {
						userId,
						conversationId,
					},
				});

				if (!participant) {
					throw new GraphQLError("Participant entity not found");
				}

				await prisma.conversationParticipant.update({
					where: {
						id: participant.id,
					},
					data: {
						hasSeenLatestMessage: true,
					},
				});

				return true;
			} catch (error: any) {
				console.log("markConversationAsRead error", error);
				throw new GraphQLError(error?.message);
			}
		},
		deleteConversation: async (
			_: any,
			args: { conversationId: string },
			context: GraphQLContext
		): Promise<Boolean> => {
			const { session, prisma, pubsub } = context;
			const { conversationId } = args;

			if (!session?.user) {
				throw new GraphQLError("Not authorized");
			}

			try {
				const [participants, __, ___, ____, deletedConversation] =
					await prisma.$transaction([
						prisma.conversationParticipant.findMany({
							where: {
								conversationId,
							},
						}),
						prisma.conversationParticipant.deleteMany({
							where: {
								conversationId,
							},
						}),
						prisma.conversation.update({
							where: {
								id: conversationId,
							},
							data: {
								latestMessageId: null,
							},
						}),
						prisma.message.deleteMany({
							where: {
								conversationId,
							},
						}),
						prisma.conversation.delete({
							where: {
								id: conversationId,
							},
							include: conversationPopulated,
						}),
					]);

				pubsub.publish("CONVERSATION_DELETED", {
					conversationDeleted: {
						...deletedConversation,
						participants,
					},
				});
			} catch (error: any) {
				console.log("deleteConversation error", error);
				throw new GraphQLError("Failed to delete conversation");
			}

			return true;
		},
	},
	Subscription: {
		conversationCreated: {
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

					if (!session?.user) {
						throw new GraphQLError("Not authorized");
					}

					const {
						user: { id: userId },
					} = session;

					const {
						conversationCreated: { participants },
					} = payload;

					return userIsConversationParticipant(participants, userId);
				}
			),
		},
		conversationUpdated: {
			subscribe: withFilter(
				(_: any, __: any, context: GraphQLContext) => {
					const { pubsub } = context;

					return pubsub.asyncIterator(["CONVERSATION_UPDATED"]);
				},
				(
					payload: ConversationUpdatedSubscriptionPayload,
					_,
					context: GraphQLContext
				) => {
					const { session } = context;

					if (!session?.user) {
						throw new GraphQLError("Not authorized");
					}

					const {
						user: { id: userId },
					} = session;
					const {
						conversationUpdated: {
							conversation: { participants },
						},
					} = payload;

					return userIsConversationParticipant(participants, userId);
				}
			),
		},
		conversationDeleted: {
			subscribe: withFilter(
				(_: any, __: any, context: GraphQLContext) => {
					const { pubsub } = context;

					return pubsub.asyncIterator(["CONVERSATION_DELETED"]);
				},
				(
					payload: ConversationDeletedSubscriptionPayload,
					_: any,
					context: GraphQLContext
				) => {
					const { session } = context;

					if (!session?.user) {
						throw new GraphQLError("Not authorized");
					}

					const {
						user: { id: userId },
					} = session;

					const {
						conversationDeleted: { participants },
					} = payload;

					return userIsConversationParticipant(participants, userId);
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
