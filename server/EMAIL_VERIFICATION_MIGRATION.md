# Deliberately verifying existing development users

Email verification is enabled for new accounts. Existing user documents are not
changed automatically: records without `emailVerified` are treated as
unverified and cannot access task or player routes until they are deliberately
updated.

For a known **development-only** account, first back up the database and then
run this command in `mongosh`, replacing the placeholder email with the exact
account you intend to verify:

```javascript
db.users.updateOne(
  { email: "known-development-user@example.com" },
  {
    $set: { emailVerified: true },
    $unset: {
      emailVerificationTokenHash: "",
      emailVerificationExpiresAt: "",
    },
  }
)
```

Do not run a blanket update against every account. Production users should
receive a real verification email instead of being silently marked verified.
