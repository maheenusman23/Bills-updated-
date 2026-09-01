import { pool } from "./db";
import {
  User, Case, CaseFile, GeneratedDocument, Match, AppNotification, PaymentRecord, ApiCostTracker,
} from "../types";

// ---------- row -> camelCase object mappers ----------

function mapUser(r: any): User {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    password: r.password,
    licenseNumber: r.license_number || undefined,
    orgName: r.org_name || undefined,
    orgType: r.org_type || undefined,
    bio: r.bio || undefined,
    acceptedTerms: Boolean(r.accepted_terms),
    planId: r.plan_id,
    availableCredits: Number(r.available_credits),
    totalCreditsUsed: Number(r.total_credits_used),
    matchmakingConsent: Boolean(r.matchmaking_consent),
    isBlocked: Boolean(r.is_blocked),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    planExpiresAt: r.plan_expires_at ? (r.plan_expires_at instanceof Date ? r.plan_expires_at.toISOString() : r.plan_expires_at) : undefined,
    resetOtp: r.reset_otp || undefined,
    resetOtpExpiresAt: r.reset_otp_expires_at ? new Date(r.reset_otp_expires_at).getTime() : undefined,
  } as User;
}

function mapCase(r: any): Case {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    patientName: r.patient_name || undefined,
    userId: r.user_id,
    role: r.role,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    status: r.status,
    fileCount: r.file_count !== undefined ? Number(r.file_count) : undefined,
  };
}

const CASE_SELECT_WITH_FILE_COUNT = `
  SELECT c.*, (SELECT COUNT(*) FROM case_files cf WHERE cf.case_id = c.id) AS file_count
  FROM cases c
`;

function mapCaseFile(r: any): CaseFile {
  return {
    id: r.id,
    caseId: r.case_id,
    originalFilename: r.original_filename,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    ocrText: r.ocr_text || undefined,
    ocrStatus: r.ocr_status,
    validationStatus: r.validation_status,
    rejectionReason: r.rejection_reason || undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function mapDocument(r: any): GeneratedDocument {
  return {
    id: r.id,
    caseId: r.case_id,
    userId: r.user_id,
    role: r.role,
    title: r.title,
    serviceType: r.service_type,
    content: r.content,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    downloaded: Boolean(r.downloaded),
    isLocked: Boolean(r.is_locked),
  };
}

function mapMatch(r: any): Match {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    clientEmail: r.client_email,
    lawyerId: r.lawyer_id,
    lawyerName: r.lawyer_name,
    lawyerEmail: r.lawyer_email,
    clientConsented: Boolean(r.client_consented),
    lawyerConsented: Boolean(r.lawyer_consented),
    status: r.status,
    initiatedBy: r.initiated_by,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    isTimedOut: Boolean(r.is_timed_out),
    notified: Boolean(r.notified),
  };
}

function mapNotification(r: any): AppNotification {
  return {
    id: r.id,
    userId: r.user_id,
    message: r.message,
    type: r.type,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    read: Boolean(r.read),
  };
}

function mapPayment(r: any): PaymentRecord {
  return {
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    amount: Number(r.amount),
    item: r.item,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function mapApiCost(r: any): ApiCostTracker {
  return {
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    role: r.role,
    serviceType: r.service_type,
    cost: Number(r.cost),
    revenue: Number(r.revenue),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

// ---------- users ----------

export const usersRepo = {
  async findById(id: string): Promise<User | null> {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
    return rows[0] ? mapUser(rows[0]) : null;
  },

  async findLawyerByLicense(licenseNumber: string): Promise<User | null> {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE role = 'lawyer' AND lower(license_number) = lower($1)",
      [licenseNumber]
    );
    return rows[0] ? mapUser(rows[0]) : null;
  },

  async list(): Promise<User[]> {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at ASC");
    return rows.map(mapUser);
  },

  async insert(u: User): Promise<User> {
    const { rows } = await pool.query(
      `INSERT INTO users (id, email, name, role, password, license_number, org_name, org_type, bio, accepted_terms, plan_id, available_credits, total_credits_used, matchmaking_consent, is_blocked, created_at, plan_expires_at, reset_otp, reset_otp_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, role=EXCLUDED.role, password=EXCLUDED.password
       RETURNING *`,
      [
        u.id, u.email, u.name, u.role, u.password, u.licenseNumber || null, u.orgName || null, u.orgType || null,
        u.bio || null, !!u.acceptedTerms, u.planId || "free", u.availableCredits || 0, u.totalCreditsUsed || 0,
        !!u.matchmakingConsent, !!u.isBlocked, u.createdAt || new Date().toISOString(), u.planExpiresAt || null,
        u.resetOtp || null, u.resetOtpExpiresAt ? new Date(u.resetOtpExpiresAt) : null,
      ]
    );
    return mapUser(rows[0]);
  },

  async update(id: string, patch: Partial<User>): Promise<User | null> {
    const fieldMap: Record<string, string> = {
      email: "email", name: "name", role: "role", password: "password", licenseNumber: "license_number",
      orgName: "org_name", orgType: "org_type", bio: "bio", acceptedTerms: "accepted_terms", planId: "plan_id",
      availableCredits: "available_credits", totalCreditsUsed: "total_credits_used",
      matchmakingConsent: "matchmaking_consent", isBlocked: "is_blocked", planExpiresAt: "plan_expires_at",
      resetOtp: "reset_otp", resetOtpExpiresAt: "reset_otp_expires_at",
    };
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in patch) {
        let val = (patch as any)[key];
        if (key === "resetOtpExpiresAt" && val) val = new Date(val);
        sets.push(`${col} = $${i}`);
        values.push(val === undefined ? null : val);
        i++;
      }
    }
    if (sets.length === 0) return usersRepo.findById(id);
    values.push(id);
    const { rows } = await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, values);
    return rows[0] ? mapUser(rows[0]) : null;
  },

  async clearResetOtp(id: string): Promise<void> {
    await pool.query("UPDATE users SET reset_otp = NULL, reset_otp_expires_at = NULL WHERE id = $1", [id]);
  },

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM users WHERE id = $1", [id]);
    return (rowCount || 0) > 0;
  },
};

// ---------- cases ----------

export const casesRepo = {
  async findById(id: string): Promise<Case | null> {
    const { rows } = await pool.query("SELECT * FROM cases WHERE id = $1", [id]);
    return rows[0] ? mapCase(rows[0]) : null;
  },

  async listByUser(userId: string): Promise<Case[]> {
    const { rows } = await pool.query(`${CASE_SELECT_WITH_FILE_COUNT} WHERE c.user_id = $1 ORDER BY c.created_at DESC`, [userId]);
    return rows.map(mapCase);
  },

  async listAll(): Promise<Case[]> {
    const { rows } = await pool.query(`${CASE_SELECT_WITH_FILE_COUNT} ORDER BY c.created_at DESC`);
    return rows.map(mapCase);
  },

  async listMostRecentByUser(userId: string): Promise<Case | null> {
    const { rows } = await pool.query(
      "SELECT * FROM cases WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId]
    );
    return rows[0] ? mapCase(rows[0]) : null;
  },

  async insert(c: Case): Promise<Case> {
    const { rows } = await pool.query(
      `INSERT INTO cases (id, title, description, patient_name, user_id, role, created_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [c.id, c.title, c.description || "", c.patientName || null, c.userId, c.role, c.createdAt || new Date().toISOString(), c.status || "Analyzing Uploads"]
    );
    return mapCase(rows[0]);
  },

  async updateStatus(id: string, status: string): Promise<void> {
    await pool.query("UPDATE cases SET status = $1 WHERE id = $2", [status, id]);
  },

  async delete(id: string): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM cases WHERE id = $1", [id]);
    return (rowCount || 0) > 0;
  },
};

// ---------- case_files ----------

export const caseFilesRepo = {
  async findById(id: string): Promise<CaseFile | null> {
    const { rows } = await pool.query("SELECT * FROM case_files WHERE id = $1", [id]);
    return rows[0] ? mapCaseFile(rows[0]) : null;
  },

  async listByCase(caseId: string): Promise<CaseFile[]> {
    const { rows } = await pool.query("SELECT * FROM case_files WHERE case_id = $1 ORDER BY created_at ASC", [caseId]);
    return rows.map(mapCaseFile);
  },

  async insert(f: Omit<CaseFile, "createdAt"> & { minioObjectKey: string }): Promise<CaseFile> {
    const { rows } = await pool.query(
      `INSERT INTO case_files (id, case_id, minio_object_key, original_filename, mime_type, size_bytes, ocr_status, validation_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [f.id, f.caseId, f.minioObjectKey, f.originalFilename, f.mimeType, f.sizeBytes, f.ocrStatus || "pending", f.validationStatus || "pending"]
    );
    return mapCaseFile(rows[0]);
  },

  async getObjectKey(id: string): Promise<string | null> {
    const { rows } = await pool.query("SELECT minio_object_key FROM case_files WHERE id = $1", [id]);
    return rows[0]?.minio_object_key || null;
  },

  async updateOcr(id: string, patch: { ocrText?: string | null; ocrStatus: string }): Promise<void> {
    await pool.query("UPDATE case_files SET ocr_text = $1, ocr_status = $2 WHERE id = $3", [
      patch.ocrText ?? null, patch.ocrStatus, id,
    ]);
  },

  async updateValidation(id: string, patch: { validationStatus: string; rejectionReason?: string | null }): Promise<void> {
    await pool.query("UPDATE case_files SET validation_status = $1, rejection_reason = $2 WHERE id = $3", [
      patch.validationStatus, patch.rejectionReason ?? null, id,
    ]);
  },
};

// ---------- documents ----------

export const documentsRepo = {
  async findById(id: string): Promise<GeneratedDocument | null> {
    const { rows } = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
    return rows[0] ? mapDocument(rows[0]) : null;
  },

  async listByUser(userId: string): Promise<GeneratedDocument[]> {
    const { rows } = await pool.query("SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return rows.map(mapDocument);
  },

  async listAll(): Promise<GeneratedDocument[]> {
    const { rows } = await pool.query("SELECT * FROM documents ORDER BY created_at DESC");
    return rows.map(mapDocument);
  },

  async existsForUserCaseService(userId: string, caseId: string, serviceType: string): Promise<boolean> {
    const { rows } = await pool.query(
      "SELECT 1 FROM documents WHERE user_id = $1 AND case_id = $2 AND service_type = $3 LIMIT 1",
      [userId, caseId, serviceType]
    );
    return rows.length > 0;
  },

  async insert(d: GeneratedDocument): Promise<GeneratedDocument> {
    const { rows } = await pool.query(
      `INSERT INTO documents (id, case_id, user_id, role, title, service_type, content, created_at, downloaded, is_locked)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [d.id, d.caseId, d.userId, d.role, d.title, d.serviceType, d.content, d.createdAt || new Date().toISOString(), !!d.downloaded, !!d.isLocked]
    );
    return mapDocument(rows[0]);
  },

  async updateLockState(id: string, patch: { downloaded?: boolean; isLocked?: boolean }): Promise<GeneratedDocument | null> {
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (patch.downloaded !== undefined) { sets.push(`downloaded = $${i++}`); values.push(patch.downloaded); }
    if (patch.isLocked !== undefined) { sets.push(`is_locked = $${i++}`); values.push(patch.isLocked); }
    if (sets.length === 0) return documentsRepo.findById(id);
    values.push(id);
    const { rows } = await pool.query(`UPDATE documents SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, values);
    return rows[0] ? mapDocument(rows[0]) : null;
  },
};

// ---------- matches ----------

export const matchesRepo = {
  async findById(id: string): Promise<Match | null> {
    const { rows } = await pool.query("SELECT * FROM matches WHERE id = $1", [id]);
    return rows[0] ? mapMatch(rows[0]) : null;
  },

  async findByClientAndLawyer(clientId: string, lawyerId: string): Promise<Match | null> {
    const { rows } = await pool.query("SELECT * FROM matches WHERE client_id = $1 AND lawyer_id = $2", [clientId, lawyerId]);
    return rows[0] ? mapMatch(rows[0]) : null;
  },

  async listByClient(clientId: string): Promise<Match[]> {
    const { rows } = await pool.query("SELECT * FROM matches WHERE client_id = $1 ORDER BY created_at DESC", [clientId]);
    return rows.map(mapMatch);
  },

  async listByLawyer(lawyerId: string): Promise<Match[]> {
    const { rows } = await pool.query("SELECT * FROM matches WHERE lawyer_id = $1 ORDER BY created_at DESC", [lawyerId]);
    return rows.map(mapMatch);
  },

  async listAll(): Promise<Match[]> {
    const { rows } = await pool.query("SELECT * FROM matches ORDER BY created_at DESC");
    return rows.map(mapMatch);
  },

  async insert(m: Match): Promise<Match> {
    const { rows } = await pool.query(
      `INSERT INTO matches (id, client_id, client_name, client_email, lawyer_id, lawyer_name, lawyer_email, client_consented, lawyer_consented, status, initiated_by, created_at, is_timed_out, notified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [m.id, m.clientId, m.clientName, m.clientEmail, m.lawyerId, m.lawyerName, m.lawyerEmail, !!m.clientConsented, !!m.lawyerConsented, m.status || null, m.initiatedBy || null, m.createdAt || new Date().toISOString(), !!m.isTimedOut, !!m.notified]
    );
    return mapMatch(rows[0]);
  },

  async update(id: string, patch: Partial<Match>): Promise<Match | null> {
    const fieldMap: Record<string, string> = {
      status: "status", clientConsented: "client_consented", lawyerConsented: "lawyer_consented",
      initiatedBy: "initiated_by", createdAt: "created_at", isTimedOut: "is_timed_out", notified: "notified",
    };
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in patch) {
        sets.push(`${col} = $${i}`);
        values.push((patch as any)[key]);
        i++;
      }
    }
    if (sets.length === 0) return matchesRepo.findById(id);
    values.push(id);
    const { rows } = await pool.query(`UPDATE matches SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, values);
    return rows[0] ? mapMatch(rows[0]) : null;
  },

  async delete(id: string): Promise<void> {
    await pool.query("DELETE FROM matches WHERE id = $1", [id]);
  },

  /** Flips any match pending >=24h to timed_out and returns the rows that changed, for notification fan-out. */
  async processTimeouts(): Promise<Match[]> {
    const { rows } = await pool.query(
      `UPDATE matches
       SET status = 'timed_out', is_timed_out = true, notified = true
       WHERE status LIKE 'pending_%' AND is_timed_out = false AND created_at < now() - interval '24 hours'
       RETURNING *`
    );
    return rows.map(mapMatch);
  },
};

// ---------- notifications ----------

export const notificationsRepo = {
  async listByUser(userId: string): Promise<AppNotification[]> {
    const { rows } = await pool.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return rows.map(mapNotification);
  },

  async insert(n: AppNotification): Promise<AppNotification> {
    const { rows } = await pool.query(
      `INSERT INTO notifications (id, user_id, message, type, created_at, read)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [n.id, n.userId, n.message, n.type, n.createdAt || new Date().toISOString(), !!n.read]
    );
    return mapNotification(rows[0]);
  },

  async markRead(id: string): Promise<void> {
    await pool.query("UPDATE notifications SET read = true WHERE id = $1", [id]);
  },

  async notifyAdmins(message: string): Promise<void> {
    const { rows } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    for (const r of rows) {
      await notificationsRepo.insert({
        id: "not_" + Math.random().toString(36).substring(2, 11),
        userId: r.id,
        message,
        type: "success",
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  },
};

// ---------- payments ----------

export const paymentsRepo = {
  async listAll(): Promise<PaymentRecord[]> {
    const { rows } = await pool.query("SELECT * FROM payments ORDER BY created_at DESC");
    return rows.map(mapPayment);
  },

  async listByUser(userId: string): Promise<PaymentRecord[]> {
    const { rows } = await pool.query("SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return rows.map(mapPayment);
  },

  async insert(p: PaymentRecord): Promise<PaymentRecord> {
    const { rows } = await pool.query(
      `INSERT INTO payments (id, user_id, user_email, amount, item, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [p.id, p.userId, p.userEmail, p.amount, p.item, p.createdAt || new Date().toISOString()]
    );
    return mapPayment(rows[0]);
  },
};

// ---------- api_costs ----------

export const apiCostsRepo = {
  async listAll(): Promise<ApiCostTracker[]> {
    const { rows } = await pool.query("SELECT * FROM api_costs ORDER BY created_at DESC");
    return rows.map(mapApiCost);
  },

  async insert(a: ApiCostTracker): Promise<ApiCostTracker> {
    const { rows } = await pool.query(
      `INSERT INTO api_costs (id, user_id, user_email, role, service_type, cost, revenue, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [a.id, a.userId, a.userEmail, a.role, a.serviceType, a.cost, a.revenue, a.createdAt || new Date().toISOString()]
    );
    return mapApiCost(rows[0]);
  },
};

// ---------- vector embeddings ----------

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export const caseEmbeddingsRepo = {
  async upsert(caseId: string, embedding: number[], model: string): Promise<void> {
    await pool.query(
      `INSERT INTO case_embeddings (case_id, embedding, model, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (case_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, updated_at = now()`,
      [caseId, toVectorLiteral(embedding), model]
    );
  },

  async findByCaseId(caseId: string): Promise<number[] | null> {
    const { rows } = await pool.query("SELECT embedding FROM case_embeddings WHERE case_id = $1", [caseId]);
    if (!rows[0]?.embedding) return null;
    return parsePgVector(rows[0].embedding);
  },
};

export const userEmbeddingsRepo = {
  async upsert(userId: string, embedding: number[], model: string): Promise<void> {
    await pool.query(
      `INSERT INTO user_embeddings (user_id, embedding, model, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, updated_at = now()`,
      [userId, toVectorLiteral(embedding), model]
    );
  },

  /**
   * Ranks users of `role` (excluding excludeUserId) by cosine similarity of their bio
   * embedding to `queryEmbedding`. Users without an embedding yet are returned after the
   * ranked set, in their natural (creation) order, so nobody who simply hasn't filled in a
   * bio yet is ever hidden from matchmaking.
   */
  async findCandidatesRanked(role: string, excludeUserId: string, queryEmbedding: number[], limit: number): Promise<string[]> {
    const { rows: ranked } = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_embeddings ue ON ue.user_id = u.id
       WHERE u.role = $1 AND u.matchmaking_consent = true AND u.id != $2
       ORDER BY ue.embedding <=> $3
       LIMIT $4`,
      [role, excludeUserId, toVectorLiteral(queryEmbedding), limit]
    );
    const { rows: unranked } = await pool.query(
      `SELECT u.id FROM users u
       LEFT JOIN user_embeddings ue ON ue.user_id = u.id
       WHERE u.role = $1 AND u.matchmaking_consent = true AND u.id != $2 AND ue.user_id IS NULL
       ORDER BY u.created_at ASC`,
      [role, excludeUserId]
    );
    // `ranked` (has a bio embedding, sorted by similarity) always precedes `unranked`
    // (no bio yet, so nothing to rank on) so nobody is hidden just for skipping their bio.
    return [...ranked.map((r) => r.id), ...unranked.map((r) => r.id)];
  },
};

function parsePgVector(raw: string): number[] {
  // pg returns vector columns as a string like "[0.1,0.2,...]"
  return raw.replace(/^\[|\]$/g, "").split(",").map(Number);
}
