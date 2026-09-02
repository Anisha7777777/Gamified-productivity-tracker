import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import "./App.css";
import {
  AUTH_UNAUTHORIZED_EVENT,
  changePassword,
  createTask,
  deleteTask,
  getCurrentUser,
  getPlayer,
  getTasks,
  loginUser,
  logoutUser,
  requestPasswordReset,
  registerUser,
  resendVerification,
  resetPassword,
  updateAccount,
  updateTask,
  verifyEmail,
  type AuthResponse,
  type Player,
  type Task,
  type User,
} from "./services/api";

type Difficulty = Task["difficulty"];

const difficultyOptions: Array<{
  value: Difficulty;
  label: string;
  xp: number;
}> = [
  { value: "easy", label: "Easy", xp: 10 },
  { value: "medium", label: "Medium", xp: 25 },
  { value: "hard", label: "Hard", xp: 50 },
];

const questIcons = ["✦", "☘", "◆", "☀", "♬"];

const difficultyLabel = (difficulty: Difficulty) =>
  difficultyOptions.find((option) => option.value === difficulty)?.label ??
  difficulty;

function DifficultySelect({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as Difficulty)}
      disabled={disabled}
    >
      {difficultyOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label} — {option.xp} XP
        </option>
      ))}
    </select>
  );
}

function AuthScreen({
  sessionMessage,
  onAuthenticated,
  passwordResetToken,
  onPasswordReset,
}: {
  sessionMessage: string;
  onAuthenticated: (response: AuthResponse) => void;
  passwordResetToken: string | null;
  onPasswordReset: (message: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    passwordResetToken ? "reset" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  const switchMode = (nextMode: "login" | "register" | "forgot") => {
    setMode(nextMode);
    setAuthError("");
    setAuthNotice("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthError("");
    setAuthNotice("");

    try {
      if (mode === "forgot") {
        const response = await requestPasswordReset(email);
        setAuthNotice(response.message);
        return;
      }

      if (mode === "reset") {
        if (!passwordResetToken) {
          throw new Error("Password-reset link is missing or invalid");
        }

        const response = await resetPassword({
          token: passwordResetToken,
          newPassword: password,
          confirmPassword,
        });
        onPasswordReset(response.message);
        return;
      }

      const response = mode === "register"
        ? await registerUser({ name, email, password })
        : await loginUser({ email, password });

      onAuthenticated(response);
    } catch (requestError) {
      setAuthError(
        requestError instanceof Error
          ? requestError.message
          : "Authentication failed"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-orbit auth-orbit-one" />
      <div className="auth-orbit auth-orbit-two" />
      <main className="auth-card">
        <section className="auth-story" aria-hidden="true">
          <div className="brand-mark"><span>Q</span> Questly</div>
          <div className="auth-illustration">
            <span>✦</span>
            <div>🧙🏽</div>
          </div>
          <p className="auth-kicker">YOUR NEXT CHAPTER</p>
          <h1>Turn small steps into an adventure.</h1>
          <p>Keep your quests, XP, streak, and progress safely tied to you.</p>
        </section>

        <section className="auth-form-panel">
          {mode === "login" || mode === "register" ? (
            <div className="auth-tabs" role="tablist" aria-label="Account action">
              <button type="button" role="tab" aria-selected={mode === "login"}
                className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Create account</button>
            </div>
          ) : (
            <button className="auth-back" type="button" onClick={() => switchMode("login")}>← Back to sign in</button>
          )}

          <div className="auth-heading">
            <p>{mode === "reset" ? "CHOOSE A NEW PASSWORD" : mode === "forgot" ? "RECOVER YOUR ACCOUNT" : mode === "login" ? "WELCOME BACK" : "BEGIN YOUR JOURNEY"}</p>
            <h2>{mode === "reset" ? "Reset your password" : mode === "forgot" ? "Find your way back" : mode === "login" ? "Continue your quest" : "Create your adventurer"}</h2>
            <span>{mode === "reset" ? "This link can be used once and expires soon." : mode === "forgot" ? "We’ll email a secure reset link if the address has an account." : mode === "login" ? "Your progress is waiting." : "One account, one private quest log."}</span>
          </div>

          {sessionMessage && <p className="auth-message" role="status">{sessionMessage}</p>}
          {authNotice && <p className="auth-message" role="status">{authNotice}</p>}
          {authError && <p className="auth-error" role="alert">{authError}</p>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label htmlFor="auth-name">
                <span>Name</span>
                <input id="auth-name" value={name} onChange={(event) => setName(event.target.value)}
                  autoComplete="name" maxLength={80} required disabled={submitting} placeholder="Your name" />
              </label>
            )}
            {mode !== "reset" && (
              <label htmlFor="auth-email">
                <span>Email</span>
                <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email" required disabled={submitting} placeholder="you@example.com" />
              </label>
            )}
            {mode !== "forgot" && (
              <label htmlFor="auth-password">
                <span>{mode === "reset" ? "New password" : "Password"}</span>
                <input id="auth-password" type="password" value={password}
                  onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={8} maxLength={128} required disabled={submitting} placeholder="At least 8 characters" />
              </label>
            )}
            {mode === "reset" && (
              <label htmlFor="auth-confirm-password">
                <span>Confirm new password</span>
                <input id="auth-confirm-password" type="password" value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password"
                  minLength={8} maxLength={128} required disabled={submitting} placeholder="Repeat your new password" />
              </label>
            )}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "forgot" ? "Email reset link" : mode === "reset" ? "Save new password" : mode === "login" ? "Enter Questly" : "Create my account"}
              <span>→</span>
            </button>
            {mode === "login" && (
              <button className="forgot-password-link" type="button" onClick={() => switchMode("forgot")}>
                Forgot your password?
              </button>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}

function UnverifiedAccountScreen({
  user,
  message,
  onUserUpdated,
  onLogout,
}: {
  user: User;
  message: string;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
}) {
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState(message);
  const [error, setError] = useState("");

  const handleResend = async () => {
    setResending(true);
    setError("");

    try {
      const response = await resendVerification();
      onUserUpdated(response.user);
      setNotice(response.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not send a verification email"
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-orbit auth-orbit-one" />
      <div className="auth-orbit auth-orbit-two" />
      <main className="verification-card">
        <div className="verification-seal" aria-hidden="true">✉</div>
        <p className="auth-kicker">ONE MORE STEP</p>
        <h1>Check your email</h1>
        <p>We sent a verification link to <strong>{user.email}</strong>.</p>
        <p>Verify that address to unlock your quests, XP, and player progress.</p>
        {notice && <p className="auth-message" role="status">{notice}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="button" disabled={resending} onClick={handleResend}>
          {resending ? "Sending…" : "Resend verification email"}<span>→</span>
        </button>
        <button className="forgot-password-link verification-logout" type="button" onClick={onLogout}>
          Log out
        </button>
      </main>
    </div>
  );
}

const readEmailActionTokens = () => {
  const parameters = new URLSearchParams(window.location.search);
  const passwordResetToken = parameters.get("resetPasswordToken");
  const emailVerificationToken = parameters.get("verifyEmailToken");

  if (passwordResetToken || emailVerificationToken) {
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.hash}`);
  }

  return { passwordResetToken, emailVerificationToken };
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [emailActionTokens] = useState(readEmailActionTokens);
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(
    emailActionTokens.passwordResetToken
  );
  const [emailVerificationToken, setEmailVerificationToken] = useState<string | null>(
    emailActionTokens.emailVerificationToken
  );
  const [openedFromEmailActionLink] = useState(
    () => passwordResetToken !== null || emailVerificationToken !== null
  );
  const [authChecking, setAuthChecking] = useState(
    () => !openedFromEmailActionLink
  );
  const [verificationChecking, setVerificationChecking] = useState(
    () => emailVerificationToken !== null
  );
  const [authMessage, setAuthMessage] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [player, setPlayer] = useState<Player | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDifficulty, setEditDifficulty] =
    useState<Difficulty>("medium");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [xpNotice, setXpNotice] = useState<{
    message: string;
    kind: "gain" | "loss";
  } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsEmail, setSettingsEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const completedCount = tasks.filter((task) => task.completed).length;
  const completionPercent = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;
  const levelProgress = player
    ? Math.min(100, (player.currentLevelXp / player.xpForNextLevel) * 100)
    : 0;
  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date());

  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      setUser(null);
      setTasks([]);
      setPlayer(null);
      setLoading(false);
      setAuthMessage(message);
      setAuthChecking(false);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => {
    if (openedFromEmailActionLink) {
      return;
    }

    getCurrentUser()
      .then(({ user: restoredUser }) => {
        setLoading(true);
        setUser(restoredUser);
        setAuthMessage("");
      })
      .catch((requestError: Error) => {
        if (requestError.message !== "Authentication required") {
          setAuthMessage(requestError.message);
        }
      })
      .finally(() => setAuthChecking(false));
  }, [openedFromEmailActionLink]);

  useEffect(() => {
    if (!emailVerificationToken) {
      return;
    }

    const verify = async () => {
      try {
        await verifyEmail(emailVerificationToken);

        try {
          const { user: currentUser } = await getCurrentUser();
          setLoading(true);
          setUser(currentUser);
          setAuthMessage("");
          setVerificationMessage(
            "Email verified! Your quests and player progress are unlocked."
          );
        } catch {
          setUser(null);
          setAuthMessage("Email verified. Please sign in to continue.");
        }
      } catch (requestError) {
        let restoredSession = false;

        try {
          const { user: currentUser } = await getCurrentUser();
          setUser(currentUser);
          restoredSession = true;
        } catch {
          setUser(null);
        }

        const message =
          requestError instanceof Error
            ? requestError.message
            : "Email verification could not be completed";

        if (restoredSession) {
          setError(message);
        } else {
          setAuthMessage(message);
        }
      } finally {
        setEmailVerificationToken(null);
        setVerificationChecking(false);
        setAuthChecking(false);
      }
    };

    void verify();
  }, [emailVerificationToken]);

  useEffect(() => {
    if (!user || !user.emailVerified) {
      return;
    }

    Promise.all([getTasks(), getPlayer()])
      .then(([loadedTasks, loadedPlayer]) => {
        setTasks(loadedTasks);
        setPlayer(loadedPlayer);
      })
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!xpNotice) return;

    const timer = window.setTimeout(() => setXpNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [xpNotice]);

  useEffect(() => {
    if (!levelUp) return;

    const timer = window.setTimeout(() => setLevelUp(null), 3200);
    return () => window.clearTimeout(timer);
  }, [levelUp]);

  const showError = (requestError: unknown) =>
    setError(
      requestError instanceof Error
        ? requestError.message
        : "Something went wrong"
    );

  const handleAuthenticated = (response: AuthResponse) => {
    setLoading(true);
    setUser(response.user);
    setAuthMessage("");
  };

  const handleLogout = async () => {
    if (logoutBusy) return;

    setLogoutBusy(true);
    setError("");

    try {
      await logoutUser();
      setUser(null);
      setTasks([]);
      setPlayer(null);
      setLoading(false);
      setEditingId(null);
      setShowSettings(false);
      setAuthMessage("You have been signed out on all devices.");
    } catch (requestError) {
      showError(requestError);
    } finally {
      setLogoutBusy(false);
    }
  };

  const openSettings = () => {
    if (!user) return;

    setSettingsName(user.name);
    setSettingsEmail(user.email);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSettingsMessage("");
    setSettingsError("");
    setShowSettings(true);
  };

  const handleAccountUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setSettingsBusy(true);
    setSettingsError("");
    setSettingsMessage("");

    try {
      const response = await updateAccount({
        name: settingsName,
        email: settingsEmail,
      });
      setUser(response.user);
      setSettingsName(response.user.name);
      setSettingsEmail(response.user.email);
      if (!response.user.emailVerified) {
        setShowSettings(false);
        setAuthMessage(
          "Your email changed. Check your new inbox to verify it before using quests and progression."
        );
      } else {
        setSettingsMessage("Account details saved.");
      }
    } catch (requestError) {
      setSettingsError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update your account"
      );
    } finally {
      setSettingsBusy(false);
    }
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordBusy(true);
    setSettingsError("");
    setSettingsMessage("");

    try {
      const response = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setUser(null);
      setTasks([]);
      setPlayer(null);
      setEditingId(null);
      setShowSettings(false);
      setAuthMessage(response.message);
    } catch (requestError) {
      setSettingsError(
        requestError instanceof Error
          ? requestError.message
          : "Could not change your password"
      );
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const task = await createTask({ title, description, difficulty });
      setTasks((current) => [task, ...current]);
      setTitle("");
      setDescription("");
      setDifficulty("medium");
    } catch (requestError) {
      showError(requestError);
    } finally {
      setSaving(false);
    }
  };

  const replaceTask = (updated: Task) => {
    setTasks((current) =>
      current.map((item) => (item._id === updated._id ? updated : item))
    );
  };

  const handleToggle = async (task: Task) => {
    if (busyTaskId) return;

    setError("");
    setBusyTaskId(task._id);
    const wasCompleted = task.completed;
    const previousPlayer = player;

    try {
      const result = await updateTask(task._id, {
        completed: !wasCompleted,
      });

      replaceTask(result.task);
      setPlayer(result.player);

      if (previousPlayer) {
        const xpDifference = result.player.totalXp - previousPlayer.totalXp;

        if (xpDifference > 0) {
          setXpNotice({
            message: `+${result.task.xpReward} XP`,
            kind: "gain",
          });
        } else if (xpDifference < 0) {
          setXpNotice({
            message: "XP removed",
            kind: "loss",
          });
        }

        if (result.player.level > previousPlayer.level) {
          setLevelUp(result.player.level);
        }
      }
    } catch (requestError) {
      showError(requestError);
    } finally {
      setBusyTaskId(null);
    }
  };

  const beginEdit = (task: Task) => {
    setEditingId(task._id);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditDifficulty(task.difficulty);
  };

  const handleEdit = async (event: FormEvent, id: string) => {
    event.preventDefault();
    if (busyTaskId) return;

    setError("");
    setBusyTaskId(id);

    try {
      const result = await updateTask(id, {
        title: editTitle,
        description: editDescription,
        difficulty: editDifficulty,
      });
      replaceTask(result.task);
      setPlayer(result.player);
      setEditingId(null);
    } catch (requestError) {
      showError(requestError);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (busyTaskId) return;

    setError("");
    setBusyTaskId(id);

    try {
      await deleteTask(id);
      setTasks((current) => current.filter((task) => task._id !== id));
    } catch (requestError) {
      showError(requestError);
    } finally {
      setBusyTaskId(null);
    }
  };

  if (authChecking || verificationChecking) {
    return (
      <div className="auth-page">
        <div className="session-loader" role="status">
          <span>✦</span>
          <p>{verificationChecking ? "Verifying your email…" : "Restoring your adventure…"}</p>
        </div>
      </div>
    );
  }

  if (!user || passwordResetToken) {
    return (
      <AuthScreen
        key={passwordResetToken ?? "account-access"}
        sessionMessage={authMessage}
        onAuthenticated={handleAuthenticated}
        passwordResetToken={passwordResetToken}
        onPasswordReset={(message) => {
          setPasswordResetToken(null);
          setAuthMessage(message);
        }}
      />
    );
  }

  if (!user.emailVerified) {
    return (
      <UnverifiedAccountScreen
        user={user}
        message={authMessage}
        onUserUpdated={setUser}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="game-page">
      <div className="sun-orbit sun-orbit-one" />
      <div className="sun-orbit sun-orbit-two" />

      {xpNotice && (
        <div
          className={`xp-notice ${xpNotice.kind}`}
          role="status"
          aria-live="polite"
        >
          <span>{xpNotice.kind === "gain" ? "✦" : "↩"}</span>
          {xpNotice.message}
        </div>
      )}

      {levelUp && (
        <div
          className="level-up-celebration"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="level-rays" aria-hidden="true">✦</span>
          <small>Quest milestone</small>
          <strong>Level {levelUp}!</strong>
          <p>Your journey grows.</p>
        </div>
      )}

      <main className="quest-app" aria-busy={loading}>
        <aside className="player-card">
          <div className="brand-row">
            <div className="brand-mark"><span>Q</span> Questly</div>
            <div className="account-actions">
              <button className="settings-button" type="button" onClick={openSettings}>Settings</button>
              <button className="logout-button" type="button" onClick={handleLogout} disabled={logoutBusy}>
                {logoutBusy ? "Signing out…" : "Log out"}
              </button>
            </div>
          </div>

          <div className="account-label"><span>{user.name.slice(0, 1).toUpperCase()}</span><div><small>Signed in as</small><strong>{user.name}</strong></div></div>

          <div className="avatar-scene" aria-hidden="true">
            <span className="spark spark-one">✦</span>
            <span className="spark spark-two">✦</span>
            <div className="avatar">🧙🏽</div>
            <div className="hill hill-back" />
            <div className="hill hill-front" />
          </div>

          <div className="player-copy">
            <span className="level-pill">LEVEL {player?.level ?? 1}</span>
            <h2>{player?.name ?? "Trailblazer"}</h2>
            <p>Small quests. Big momentum.</p>
          </div>

          <div className="stat-stack">
            <div className="stat-row">
              <span className="stat-icon total">✦</span>
              <div><span>Total XP</span><strong>{player?.totalXp ?? 0} XP</strong></div>
            </div>

            <div className="progress-copy">
              <span>Level {player?.level ?? 1} progress</span>
              <strong>{player?.currentLevelXp ?? 0} / {player?.xpForNextLevel ?? 100} XP</strong>
            </div>
            <div
              className="meter xp"
              role="progressbar"
              aria-label="XP progress toward the next level"
              aria-valuemin={0}
              aria-valuemax={player?.xpForNextLevel ?? 100}
              aria-valuenow={player?.currentLevelXp ?? 0}
              aria-valuetext={`${player?.currentLevelXp ?? 0} of ${player?.xpForNextLevel ?? 100} XP`}
            >
              <i style={{ width: `${levelProgress}%` }} />
            </div>

            <div className="player-counts">
              <div><span>✓</span><strong>{player?.completedTasks ?? 0}</strong><small>completed</small></div>
              <div><span>🔥</span><strong>{player?.streak ?? 0}</strong><small>day streak</small></div>
            </div>
          </div>

          <blockquote>“Progress is a path you make by walking.”</blockquote>
        </aside>

        <section className="quest-board">
          <header className="board-header">
            <div>
              <p className="date-line">{today}</p>
              <h1>Today’s quests</h1>
              <p className="subheading">Choose your next move, adventurer.</p>
            </div>
            <div className="day-score" aria-label={`${completionPercent}% complete`}>
              <div
                className="score-ring"
                style={{ "--score": `${completionPercent * 3.6}deg` } as CSSProperties}
              >
                <span>{completionPercent}%</span>
              </div>
              <small>day cleared</small>
            </div>
          </header>

          <section className="new-quest" aria-labelledby="new-quest-title">
            <div className="form-heading">
              <div className="form-icon">＋</div>
              <div><h2 id="new-quest-title">Add a new quest</h2><p>What will move you forward?</p></div>
            </div>
            <form onSubmit={handleCreate}>
              <div className="field-grid">
                <label htmlFor="new-title">
                  <span>Quest name</span>
                  <input id="new-title" value={title} onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Finish the project outline" maxLength={120} required disabled={saving} />
                </label>
                <label htmlFor="new-description">
                  <span>Notes <em>optional</em></span>
                  <input id="new-description" value={description} onChange={(event) => setDescription(event.target.value)}
                    placeholder="Add a helpful detail" maxLength={500} disabled={saving} />
                </label>
                <label htmlFor="new-difficulty">
                  <span>Difficulty</span>
                  <DifficultySelect id="new-difficulty" value={difficulty} onChange={setDifficulty} disabled={saving} />
                </label>
              </div>
              <button className="primary-button" type="submit" disabled={saving || loading}>
                <span>{saving ? "Saving…" : "Begin quest"}</span><b>→</b>
              </button>
            </form>
          </section>

          {verificationMessage && (
            <p className="success-banner" role="status">
              <span>✓</span>{verificationMessage}
            </p>
          )}
          {error && <p className="error-banner" role="alert"><span>!</span>{error}</p>}

          <section className="quest-list-section" aria-labelledby="quest-list-title">
            <div className="section-heading">
              <div><p>QUEST LOG</p><h2 id="quest-list-title">Your path today</h2></div>
              <span>{completedCount} of {tasks.length} complete</span>
            </div>

            {loading ? (
              <div className="empty-state"><span>⌛</span><h3>Opening your quest log…</h3><p>Loading tasks and player progress.</p></div>
            ) : tasks.length === 0 ? (
              <div className="empty-state">
                <span>🗺️</span><h3>Your map is wide open</h3><p>Add a quest above to begin today’s adventure.</p>
              </div>
            ) : (
              <ul className="quest-list">
                {tasks.map((task, index) => {
                  const taskIsBusy = busyTaskId === task._id;

                  return (
                    <li key={task._id} className={`quest-item tone-${index % 5} ${task.completed ? "is-complete" : ""}`}>
                      {editingId === task._id ? (
                        <form className="edit-form" onSubmit={(event) => handleEdit(event, task._id)}>
                          <label htmlFor={`edit-title-${task._id}`}><span>Quest name</span><input id={`edit-title-${task._id}`}
                            value={editTitle} onChange={(event) => setEditTitle(event.target.value)}
                            maxLength={120} required autoFocus disabled={taskIsBusy} /></label>
                          <label htmlFor={`edit-description-${task._id}`}><span>Notes</span><input id={`edit-description-${task._id}`}
                            value={editDescription} onChange={(event) => setEditDescription(event.target.value)}
                            maxLength={500} disabled={taskIsBusy} /></label>
                          <label htmlFor={`edit-difficulty-${task._id}`}><span>Difficulty</span>
                            <DifficultySelect id={`edit-difficulty-${task._id}`} value={editDifficulty}
                              onChange={setEditDifficulty} disabled={taskIsBusy} /></label>
                          <div className="edit-actions">
                            <button type="submit" disabled={taskIsBusy}>{taskIsBusy ? "Saving…" : "Save changes"}</button>
                            <button type="button" disabled={taskIsBusy} onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <button className="complete-button" disabled={busyTaskId !== null}
                            onClick={() => handleToggle(task)}
                            aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>
                            {taskIsBusy ? "…" : task.completed ? "✓" : questIcons[index % questIcons.length]}
                          </button>
                          <div className="quest-copy">
                            <h3>{task.title}</h3>
                            <div className="quest-meta">
                              <span className={`difficulty-badge ${task.difficulty}`}>{difficultyLabel(task.difficulty)}</span>
                              <span className="xp-reward">+{task.xpReward} XP</span>
                            </div>
                            {task.description && <p>{task.description}</p>}
                          </div>
                          <div className="quest-actions">
                            <button disabled={busyTaskId !== null} onClick={() => beginEdit(task)} aria-label={`Edit ${task.title}`}>✎</button>
                            <button disabled={busyTaskId !== null} className="delete-button"
                              onClick={() => handleDelete(task._id)} aria-label={`Delete ${task.title}`}>×</button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>
      </main>

      {showSettings && (
        <div className="settings-backdrop" role="presentation">
          <section
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <header>
              <div>
                <p>YOUR ACCOUNT</p>
                <h2 id="settings-title">Adventurer settings</h2>
              </div>
              <button
                type="button"
                className="settings-close"
                onClick={() => setShowSettings(false)}
                aria-label="Close account settings"
                disabled={settingsBusy || passwordBusy}
              >
                ×
              </button>
            </header>

            {settingsMessage && (
              <p className="settings-success" role="status">
                {settingsMessage}
              </p>
            )}
            {settingsError && (
              <p className="settings-error" role="alert">
                {settingsError}
              </p>
            )}

            <form className="settings-form" onSubmit={handleAccountUpdate}>
              <div className="settings-section-heading">
                <h3>Profile details</h3>
                <p>Update the name and email attached to your quests.</p>
                <span className="email-verification-status verified">Email verified</span>
              </div>
              <label htmlFor="settings-name">
                <span>Name</span>
                <input
                  id="settings-name"
                  value={settingsName}
                  onChange={(event) => setSettingsName(event.target.value)}
                  maxLength={80}
                  required
                  disabled={settingsBusy}
                />
              </label>
              <label htmlFor="settings-email">
                <span>Email</span>
                <input
                  id="settings-email"
                  type="email"
                  value={settingsEmail}
                  onChange={(event) => setSettingsEmail(event.target.value)}
                  required
                  disabled={settingsBusy}
                />
              </label>
              <button type="submit" disabled={settingsBusy}>
                {settingsBusy ? "Saving…" : "Save profile"}
              </button>
            </form>

            <form className="settings-form password-form" onSubmit={handlePasswordChange}>
              <div className="settings-section-heading">
                <h3>Change password</h3>
                <p>This securely signs out every active device.</p>
              </div>
              <label htmlFor="current-password">
                <span>Current password</span>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={passwordBusy}
                />
              </label>
              <label htmlFor="new-password">
                <span>New password</span>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={passwordBusy}
                />
              </label>
              <label htmlFor="confirm-password">
                <span>Confirm new password</span>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  disabled={passwordBusy}
                />
              </label>
              <button type="submit" disabled={passwordBusy}>
                {passwordBusy ? "Changing…" : "Change password"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
