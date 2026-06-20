// Serializers live here so route.ts files only export HTTP handlers (Next.js 15 requirement).

export function serializeLead(l: any) {
  return {
    id: l._id.toString(),
    leadId: l.leadId ?? "",
    fullName: l.fullName ?? "",
    phone: l.phone ?? "",
    email: l.email ?? "",
    source: l.source ?? "",
    course: l.course ?? "",
    stage: l.stage ?? "Lead",
    notes: l.notes ?? "",
    nextFollowUpDate: l.nextFollowUpDate ? l.nextFollowUpDate.toISOString().slice(0, 10) : "",
    assignedTo: l.assignedTo ?? "",
    createdBy: l.createdBy ?? "",
    noteLog: (l.noteLog ?? []).map((n: any) => ({
      text: n.text ?? "",
      by: n.by ?? "",
      at: n.at ? new Date(n.at).toISOString() : "",
    })),
    customCourse: l.customCourse ?? "",
    createdAt: l.createdAt?.toISOString() ?? "",
    updatedAt: l.updatedAt?.toISOString() ?? "",
  };
}

export function serializeFollowUp(f: any) {
  return {
    id: f._id.toString(),
    contactName: f.contactName ?? "",
    phone: f.phone ?? "",
    course: f.course ?? "",
    followUpDate: f.followUpDate ? f.followUpDate.toISOString().slice(0, 10) : "",
    type: f.type ?? "WhatsApp Message",
    notes: f.notes ?? "",
    status: f.status ?? "Pending",
    assignedTo: f.assignedTo ?? "",
    createdBy: f.createdBy ?? "",
    leadId: f.leadId?.toString() ?? null,
    createdAt: f.createdAt?.toISOString() ?? "",
    updatedAt: f.updatedAt?.toISOString() ?? "",
  };
}

export function serializeCourse(c: any) {
  return {
    id: c._id.toString(),
    courseCode: c.courseCode ?? "",
    courseName: c.courseName ?? "",
    category: c.category ?? "",
    description: c.description ?? "",
    durationWeeks: c.durationWeeks ?? null,
    totalSessions: c.totalSessions ?? null,
    sessionsPerWeek: c.sessionsPerWeek ?? null,
    hoursPerSession: c.hoursPerSession ?? null,
    totalHours: c.totalHours ?? null,
    priceExVat: c.priceExVat ?? 0,
    vatRate: c.vatRate ?? 5,
    priceInclVat: Math.round((c.priceExVat ?? 0) * (1 + (c.vatRate ?? 5) / 100)),
    maxStudentsPerBatch: c.maxStudentsPerBatch ?? null,
    status: c.status ?? "Active",
    speaActivity: c.speaActivity ?? "",
    batches: (c.batches ?? []).map((b: any) => ({
      id: b._id?.toString() ?? "",
      batchId: b.batchId ?? "",
      batchName: b.batchName ?? "",
      startDate: b.startDate ? b.startDate.toISOString().slice(0, 10) : "",
      endDate: b.endDate ? b.endDate.toISOString().slice(0, 10) : "",
      schedule: b.schedule ?? "",
      format: b.format ?? "In-Person",
      trainerName: b.trainerName ?? "",
      maxStudents: b.maxStudents ?? null,
      status: b.status ?? "Open",
    })),
    createdAt: c.createdAt?.toISOString() ?? "",
    updatedAt: c.updatedAt?.toISOString() ?? "",
  };
}

export function serializeTrainer(t: any) {
  const contractEndDate = t.contractEndDate ? new Date(t.contractEndDate) : null;
  const contractExpiring =
    contractEndDate &&
    t.contractStatus === "Active" &&
    (contractEndDate.getTime() - Date.now()) / 86400000 <= 30;
  return {
    id: t._id.toString(),
    fullName: t.fullName ?? "",
    fullNameAr: t.fullNameAr ?? "",
    phone: t.phone ?? "",
    email: t.email ?? "",
    emiratesId: t.emiratesId ?? "",
    nationality: t.nationality ?? "",
    specialisation: t.specialisation ?? "",
    qualifications: t.qualifications ?? "",
    status: t.status ?? "Active",
    tamamStatus: t.tamamStatus ?? "Not Registered",
    tamamNumber: t.tamamNumber ?? "",
    contractStatus: t.contractStatus ?? "No Contract",
    contractStartDate: t.contractStartDate ? t.contractStartDate.toISOString().slice(0, 10) : "",
    contractEndDate: contractEndDate ? contractEndDate.toISOString().slice(0, 10) : "",
    paymentRate: t.paymentRate ?? null,
    paymentType: t.paymentType ?? "Per Session",
    notes: t.notes ?? "",
    contractExpiring: contractExpiring ?? false,
    tamamAlert: t.tamamStatus === "Pending",
    contractAlert: t.contractStatus === "Expired",
    createdAt: t.createdAt?.toISOString() ?? "",
    updatedAt: t.updatedAt?.toISOString() ?? "",
  };
}

export function serializeEnrollment(e: any) {
  const balance = Math.max(0, (e.totalFee ?? 0) - (e.amountPaid ?? 0));
  return {
    id: e._id.toString(),
    enrollmentId: e.enrollmentId ?? "",
    leadId: e.leadId?.toString() ?? null,
    fullName: e.fullName ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    emiratesId: e.emiratesId ?? "",
    nationality: e.nationality ?? "",
    course: e.course ?? "",
    batchName: e.batchName ?? "",
    startDate: e.startDate ? e.startDate.toISOString().slice(0, 10) : "",
    endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : "",
    schedule: e.schedule ?? "",
    format: e.format ?? "In-Person",
    status: e.status ?? "Active",
    paymentStatus: e.paymentStatus ?? "Instalment 1 Paid",
    totalFee: e.totalFee ?? 0,
    amountPaid: e.amountPaid ?? 0,
    balanceDue: balance,
    notes: e.notes ?? "",
    registrationDate: e.registrationDate ? e.registrationDate.toISOString().slice(0, 10) : "",
    createdAt: e.createdAt?.toISOString() ?? "",
    updatedAt: e.updatedAt?.toISOString() ?? "",
  };
}

export function serializePayment(p: any) {
  return {
    id: p._id.toString(),
    paymentId: p.paymentId ?? "",
    enrollmentId: p.enrollmentId?.toString() ?? null,
    studentName: p.studentName ?? "",
    studentPhone: p.studentPhone ?? "",
    course: p.course ?? "",
    amount: p.amount ?? 0,
    paymentType: p.paymentType ?? "Full Payment",
    paymentMethod: p.paymentMethod ?? "Cash",
    status: p.status ?? "Received",
    datePaid: p.datePaid ? p.datePaid.toISOString().slice(0, 10) : "",
    dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : "",
    receiptRef: p.receiptRef ?? "",
    notes: p.notes ?? "",
    recordedBy: p.recordedBy ?? "",
    installmentNumber: p.installmentNumber ?? null,
    totalInstallments: p.totalInstallments ?? null,
    createdAt: p.createdAt?.toISOString() ?? "",
  };
}

export function serializeExpense(e: any) {
  return {
    id: e._id.toString(),
    expenseId: e.expenseId ?? "",
    category: e.category ?? "",
    amount: e.amount ?? 0,
    expenseDate: e.expenseDate ? e.expenseDate.toISOString().slice(0, 10) : "",
    payee: e.payee ?? "",
    paymentMethod: e.paymentMethod ?? "",
    description: e.description ?? "",
    notes: e.notes ?? "",
    createdAt: e.createdAt?.toISOString() ?? "",
  };
}

export function serializeSession(s: any) {
  const records = (s.records ?? []).map((r: any) => ({
    enrollmentId: r.enrollmentId?.toString() ?? "",
    studentName: r.studentName ?? "",
    status: r.status ?? "Present",
    notes: r.notes ?? "",
  }));
  const presentCount = records.filter((r: any) => r.status === "Present" || r.status === "Late").length;
  return {
    id: s._id.toString(),
    course: s.course ?? "",
    batchName: s.batchName ?? "",
    sessionDate: s.sessionDate ? s.sessionDate.toISOString().slice(0, 10) : "",
    sessionNumber: s.sessionNumber ?? null,
    topic: s.topic ?? "",
    trainerName: s.trainerName ?? "",
    records,
    presentCount,
    totalCount: records.length,
    attendancePct: records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0,
    createdAt: s.createdAt?.toISOString() ?? "",
  };
}

// ── Centre Management System serializers ─────────────────────────────────────

export function serializeLearnerProfile(p: any) {
  const docs = (p.documents ?? []).map((d: any) => ({
    docType:    d.docType ?? "",
    label:      d.label ?? "",
    status:     d.status ?? "Missing",
    expiryDate: d.expiryDate ? new Date(d.expiryDate).toISOString().slice(0, 10) : "",
    uploadRef:  d.uploadRef ?? "",
    verifiedBy: d.verifiedBy ?? "",
    verifiedAt: d.verifiedAt ? new Date(d.verifiedAt).toISOString() : "",
    notes:      d.notes ?? "",
  }));
  const commsLog = (p.commsLog ?? []).map((c: any) => ({
    note: c.note ?? "",
    by:   c.by ?? "",
    at:   c.at ? new Date(c.at).toISOString() : "",
  }));
  // Compute required doc completion
  const required = ["Emirates ID", "Passport", "Visa", "Photo"];
  const docMap = new Map(docs.map((d: any) => [d.docType, d.status]));
  const presentCount = required.filter(
    (t) => t === "Photo" ? p.photoOnFile : docMap.get(t) === "Present"
  ).length;
  const docCompletionPct = Math.round((presentCount / required.length) * 100);

  return {
    id:                       p._id.toString(),
    enrollmentId:             p.enrollmentId?.toString() ?? "",
    fullName:                 p.fullName ?? "",
    phone:                    p.phone ?? "",
    email:                    p.email ?? "",
    emiratesId:               p.emiratesId ?? "",
    emiratesIdExpiry:         p.emiratesIdExpiry ? new Date(p.emiratesIdExpiry).toISOString().slice(0, 10) : "",
    passportNumber:           p.passportNumber ?? "",
    passportExpiry:           p.passportExpiry ? new Date(p.passportExpiry).toISOString().slice(0, 10) : "",
    visaNumber:               p.visaNumber ?? "",
    visaExpiry:               p.visaExpiry ? new Date(p.visaExpiry).toISOString().slice(0, 10) : "",
    photoOnFile:              p.photoOnFile ?? false,
    nationality:              p.nationality ?? "",
    dateOfBirth:              p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().slice(0, 10) : "",
    emergencyContactName:     p.emergencyContactName ?? "",
    emergencyContactPhone:    p.emergencyContactPhone ?? "",
    emergencyContactRelation: p.emergencyContactRelation ?? "",
    documents:                docs,
    riskStatus:               p.riskStatus ?? "Low",
    riskNotes:                p.riskNotes ?? "",
    commsLog,
    qualificationIds:         (p.qualificationIds ?? []).map((id: any) => id.toString()),
    isActive:                 p.isActive ?? true,
    docCompletionPct,
    missingRequiredDocs:      required.filter(
      (t) => t === "Photo" ? !p.photoOnFile : docMap.get(t) !== "Present"
    ),
    createdAt: p.createdAt?.toISOString() ?? "",
    updatedAt: p.updatedAt?.toISOString() ?? "",
  };
}

export function serializeQualification(q: any) {
  const units = (q.units ?? []).map((u: any) => ({
    unitCode:           u.unitCode ?? "",
    unitTitle:          u.unitTitle ?? "",
    level:              u.level ?? "",
    credits:            u.credits ?? null,
    glh:                u.glh ?? null,
    learningOutcomes:   u.learningOutcomes ?? "",
    assessmentCriteria: u.assessmentCriteria ?? "",
    isMandatory:        u.isMandatory ?? true,
  }));
  return {
    id:                q._id.toString(),
    title:             q.title ?? "",
    awardingBody:      q.awardingBody ?? "",
    level:             q.level ?? "",
    qualificationCode: q.qualificationCode ?? "",
    credits:           q.credits ?? null,
    glh:               q.glh ?? null,
    tqt:               q.tqt ?? null,
    units,
    tutorId:           q.tutorId?.toString() ?? "",
    assessorId:        q.assessorId?.toString() ?? "",
    iqaId:             q.iqaId?.toString() ?? "",
    status:            q.status ?? "Active",
    createdAt:         q.createdAt?.toISOString() ?? "",
    updatedAt:         q.updatedAt?.toISOString() ?? "",
  };
}

export function serializeLearnerAssessment(a: any) {
  const resubmissions = (a.resubmissions ?? []).map((r: any) => ({
    submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : "",
    feedback:    r.feedback ?? "",
    grade:       r.grade ?? "",
    by:          r.by ?? "",
  }));
  return {
    id:               a._id.toString(),
    learnerProfileId: a.learnerProfileId?.toString() ?? "",
    qualificationId:  a.qualificationId?.toString() ?? "",
    unitCode:         a.unitCode ?? "",
    unitTitle:        a.unitTitle ?? "",
    assignmentBrief:  a.assignmentBrief ?? "",
    dueDate:          a.dueDate ? new Date(a.dueDate).toISOString().slice(0, 10) : "",
    submittedAt:      a.submittedAt ? new Date(a.submittedAt).toISOString().slice(0, 10) : "",
    markingDeadline:  a.markingDeadline ? new Date(a.markingDeadline).toISOString().slice(0, 10) : "",
    status:           a.status ?? "Not Submitted",
    assessorId:       a.assessorId?.toString() ?? "",
    assessorFeedback: a.assessorFeedback ?? "",
    grade:            a.grade ?? "",
    resubmissions,
    fileRef:          a.fileRef ?? "",
    createdAt:        a.createdAt?.toISOString() ?? "",
    updatedAt:        a.updatedAt?.toISOString() ?? "",
  };
}
