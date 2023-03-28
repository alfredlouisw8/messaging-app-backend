import { ParticipantPopulated } from "./types";

export function userIsConversationParticipant(
	participants: ParticipantPopulated[],
	userId: string
): Boolean {
	return !!participants.find((participant) => participant.userId === userId);
}
