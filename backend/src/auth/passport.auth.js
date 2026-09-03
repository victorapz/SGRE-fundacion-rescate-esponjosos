"use strict";

import passport from "passport";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import User from "../entities/user.entity.js";
import { ACCESS_TOKEN_SECRET } from "../config/configEnv.js";
import { AppDataSource } from "../config/configDb.js";

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: ACCESS_TOKEN_SECRET,
  algorithms: ["HS256"],
};

passport.use(
  new JwtStrategy(options, async (jwtPayload, done) => {
    try {
      if (jwtPayload?.type !== "access") {
        return done(null, false);
      }

      const userId = Number(jwtPayload.sub);

      if (!Number.isInteger(userId) || userId <= 0) {
        return done(null, false);
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: {
          id_usuario: userId,
          activo: true,
        },
      });

      if (!user) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  }),
);

export function passportJwtSetup() {
  return passport;
}
