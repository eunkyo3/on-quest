/** JWT payload shape from JwtStrategy (request.user) */
export interface QuestJwtUser {
  sub: string;
  email: string;
  role: string;
  companyCode: string;
  slackMemberId: string;
}
