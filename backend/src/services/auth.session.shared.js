"use strict";

import RefreshToken from "../entities/refresh_tokens.entity.js";

export async function revokeRefreshTokensForUser(
  manager,
  userId,
  { excludeTokenHash = null } = {},
) {
  const refreshTokenRepository = manager.getRepository(RefreshToken);
  const refreshTokens = await refreshTokenRepository.find({
    where: {
      user: { id_usuario: Number(userId) },
      revoked: false,
    },
    relations: {
      user: true,
    },
  });

  const tokensToRevoke = refreshTokens.filter(
    (refreshToken) => !excludeTokenHash || refreshToken.tokenHash !== excludeTokenHash,
  );

  if (tokensToRevoke.length === 0) {
    return 0;
  }

  tokensToRevoke.forEach((refreshToken) => {
    refreshToken.revoked = true;
    refreshToken.revokedAt = new Date();
    refreshToken.compromised = false;
  });

  await refreshTokenRepository.save(tokensToRevoke);
  return tokensToRevoke.length;
}
