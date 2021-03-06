const passport = require("passport");
const FacebookStrategy = require("passport-facebook").Strategy;
const User = require("../../models/user");
const SessionManagement = require("../../services/SessionManagement");

/**
 * Returns a new Facebook Strategy using the provided credentials.
 *
 * @param {object} provider - The configuration object containing credentials for Facebook.
 */
const createFacebookStrategy = (provider) => {
  let clientID = "noID";
  let clientSecret = "noSecret";

  if (provider && provider.appID) {
    clientID = provider.appID;
    clientSecret = provider.appSecret;
  }

  return new FacebookStrategy(
    {
      clientID: clientID,
      clientSecret: clientSecret,
      callbackURL: `${process.env.HOST}/api/facebook/callback`,
      profileFields: ["name", "email", "link", "locale", "timezone", "gender"],
      passReqToCallback: true,
    },
    callback
  );
};

/**
 *
 * @param {*} req
 * @param {*} accessToken
 * @param {*} refreshToken
 * @param {*} profile
 * @param {*} done
 */
const callback = (req, accessToken, refreshToken, profile, done) => {
  if (req.user) {
    User.findOne({ facebook: profile.id }, (err, existingUser) => {
      if (err) {
        return done(err);
      }
      if (existingUser) {
        SessionManagement.login(req, existingUser);

        done(err, existingUser);
      } else {
        User.findById(req.user.id, (err, user) => {
          if (err) {
            return done(err);
          }
          user.facebook = profile.id;
          user.email = profile._json.email;
          user.username = `${profile.name.givenName} ${profile.name.familyName}`;
          user.tokens.push({ kind: "facebook", accessToken });
          user.profile.name =
            user.profile.name ||
            `${profile.name.givenName} ${profile.name.familyName}`;
          user.profile.gender = user.profile.gender || profile._json.gender;
          user.profile.picture =
            user.profile.picture ||
            `https://graph.facebook.com/${profile.id}/picture?type=large`;
          user.save((err) => {
            SessionManagement.login(req, user);

            done(err, user);
          });
        });
      }
    });
  } else {
    User.findOne({ facebook: profile.id }, (err, existingUser) => {
      if (err) {
        return done(err);
      }
      if (existingUser) {
        SessionManagement.login(req, existingUser);

        return done(null, existingUser);
      }
      const user = new User();
      user.email = profile._json.email;
      user.facebook = profile.id;
      user.username = `${profile.name.givenName} ${profile.name.familyName}`;

      user.tokens.push({ kind: "facebook", accessToken });
      user.profile.name = `${profile.name.givenName} ${profile.name.familyName}`;
      user.profile.gender = profile._json.gender;
      user.profile.picture = `https://graph.facebook.com/${profile.id}/picture?type=large`;
      user.profile.location = profile._json.location
        ? profile._json.location.name
        : "";
      user.save((err) => {
        SessionManagement.login(req, existingUser);
        done(err, user);
      });
    });
  }
};

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

module.exports = createFacebookStrategy;
