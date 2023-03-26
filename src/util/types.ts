import { Prisma, PrismaClient } from "@prisma/client";
import { ISODateString } from "next-auth";
import {
	conversationPopulated,
	participantPopulated,
} from "../graphql/resolvers/conversation";
import { Context } from "graphql-ws/lib/server";
import { PubSub } from "graphql-subscriptions";

/**
 * Server Configuration
 */

export interface GraphQLContext {
	session: Session | null;
	prisma: PrismaClient;
	pubsub: PubSub;
}

export interface Session {
	user?: User;
	expires: ISODateString;
}

export interface SubscriptionContext extends Context {
	connectionParams: {
		session?: Session;
	};
}

/**
 * Users
 */

export interface User {
	id: string;
	username: string;
	email: string;
	image: string;
	name: string;
	emailVerified: boolean;
}

export interface CreateUsernameResponse {
	success?: boolean;
	error?: string;
}

/**
 * Conversation
 */

export type ConversationPopulated = Prisma.ConversationGetPayload<{
	include: typeof conversationPopulated;
}>;

export type ParticipantPopulated = Prisma.ConversationParticipantGetPayload<{
	include: typeof participantPopulated;
}>;
