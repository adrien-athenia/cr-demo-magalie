import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import loginMagalieClean from "./login-magalie-clean.png";

const MODE_DEMO = import.meta.env.VITE_MODE_DEMO === "true";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const ORGANISATION_ID =
  import.meta.env.VITE_ORGANISATION_ID ||
  "f8671b09-e60b-44cb-9f8e-2804db12db92";

  const supabase =
  !MODE_DEMO && SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;


type Sportif = {
  id: string;
  organisation_id: string;
  profile_id?: string | null;
  nom: string;
  prenom: string;
  email?: string | null;
  telephone?: string | null;
  niveau?: string | null;
  notes?: string | null;
};

type Cours = {
  id: string;
  organisation_id: string;
  titre: string;
  jour_semaine: string;
  date_cours: string;
  heure_debut: string;
  heure_fin?: string | null;
  lieu: string;
  tarif: number;
  capacite_max: number;
  week_offset: number;
};

type Reservation = {
  id: string;
  organisation_id: string;
  cours_id: string;
  sportif_id: string;
  statut: string | null;
};

type DemandeCreneau = {
  id: string;
  organisation_id: string;
  sportif_id: string;
  jour_souhaite: string;
  message: string;
  statut: string;
  created_at: string;
};

type NotificationCoach = {
  id: string;
  organisation_id: string;
  coach_id?: string | null;
  sportif_id?: string | null;
  type: string;
  titre: string;
  message: string;
  lu: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  user_id: string;
  organisation_id: string;
  role: Role;
  nom?: string | null;
  prenom?: string | null;
};


type Toast = { type: "ok" | "err"; message: string } | null;

const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function euros(value: number) {
  return `${Math.round(value)}€`;
}

function initials(s: Sportif) {
  const p = (s.prenom || "").trim()[0] || "";
  const n = (s.nom || "").trim()[0] || "";
  return `${p}${n}`.toUpperCase() || "?";
}

function fmtTime(value?: string | null) {
  const v = String(value || "").slice(0, 5);
  return v || "--:--";
}

function fmtHoraire(c: { heure_debut?: string | null; heure_fin?: string | null }) {
  return c.heure_fin ? `${fmtTime(c.heure_debut)} - ${fmtTime(c.heure_fin)}` : fmtTime(c.heure_debut);
}

function fmtDate(date: string) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
}

function getJourFromDate(date: string) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const index = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return jours[index] || "";
}

function cleanText(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatut(statut?: string | null) {
  return String(statut || "active").toLowerCase();
}

function parseDateISO(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date(`${todayISO()}T00:00:00`) : d;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(date: string, days: number) {
  const d = parseDateISO(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function addMonthsISO(date: string, months: number) {
  const d = parseDateISO(date);
  const day = d.getDate();
  const target = new Date(d);
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISODate(target);
}

function getOccurrenceDate(startDate: string, recurrence: RecurrenceCours, index: number) {
  if (recurrence === "hebdo") return addDaysISO(startDate, index * 7);
  if (recurrence === "bihebdo") return addDaysISO(startDate, index * 14);
  if (recurrence === "mensuel") return addMonthsISO(startDate, index);
  return startDate;
}

function recurrenceLabel(recurrence: RecurrenceCours) {
  if (recurrence === "hebdo") return "Chaque semaine";
  if (recurrence === "bihebdo") return "Toutes les 2 semaines";
  if (recurrence === "mensuel") return "Tous les mois";
  return "Cours unique";
}

function getMondayISO(date: string) {
  const d = parseDateISO(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

function getWeekEndISO(weekStart: string) {
  return addDaysISO(weekStart, 6);
}

function isDateInWeek(date: string, weekStart: string) {
  return date >= weekStart && date <= getWeekEndISO(weekStart);
}

function buildOccurrencesUntil(startDate: string, recurrence: RecurrenceCours, endDate: string) {
  if (recurrence === "unique") return [startDate];
  const dates: string[] = [];
  let index = 0;
  let current = startDate;
  const safeEnd = endDate || startDate;
  while (current <= safeEnd && index < 104) {
    dates.push(current);
    index += 1;
    current = getOccurrenceDate(startDate, recurrence, index);
  }
  return dates.length ? dates : [startDate];
}

function isDemandeArchivee(d: DemandeCreneau) {
  return normalizeStatut(d.statut) !== "en_attente";
}


function userFriendlyAuthError(message: string) {
  const value = String(message || "").toLowerCase();

  if (value.includes("Un email a déjà été envoyé récemment. Réessayez dans quelques minutes.") || value.includes("rate limit")) {
    return "Un email a déjà été envoyé récemment. Réessayez dans quelques minutes.";
  }

  if (value.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }

  if (value.includes("email not confirmed")) {
    return "Email non confirmé. Vérifiez votre boîte mail.";
  }

  if (value.includes("password should be")) {
    return "Le mot de passe doit être plus sécurisé.";
  }

  return message || "Une erreur est survenue. Réessayez.";
}

function resetCoursForm() {
  return {
    titre: "",
    jour_semaine: "Lundi",
    date_cours: todayISO(),
    heure_debut: "18:00",
    heure_fin: "19:00",
    lieu: "",
    tarif: "15",
    capacite_max: "8",
    recurrence: "unique" as RecurrenceCours,
    date_fin_recurrence: addDaysISO(todayISO(), 28),
  };
}


// MODE TEST DESIGN : permet de voir tous les onglets sans se connecter.
// À utiliser uniquement dans StackBlitz pour valider l'interface.
const DESIGN_PREVIEW_CONNECTED = false;

const PREVIEW_PROFILE: Profile = {
  id: "preview-coach",
  user_id: "preview-user",
  organisation_id: ORGANISATION_ID,
  role: "coach",
  nom: "Magalie",
  prenom: "Coach",
};

const PREVIEW_SPORTIFS: Sportif[] = [
  { id: "s1", organisation_id: ORGANISATION_ID, prenom: "Lucas", nom: "Martin", email: "lucas@test.fr", telephone: "06 12 34 56 78", niveau: "Pilates", notes: "Travaille vitesse et endurance." },
  { id: "s2", organisation_id: ORGANISATION_ID, prenom: "Emma", nom: "Dupont", email: "emma@test.fr", telephone: "06 22 34 56 78", niveau: "Athlétisme", notes: "Très régulière." },
  { id: "s3", organisation_id: ORGANISATION_ID, prenom: "Hugo", nom: "Bernard", email: "hugo@test.fr", telephone: "06 32 34 56 78", niveau: "Rugby", notes: "Objectif force." },
  { id: "s4", organisation_id: ORGANISATION_ID, prenom: "Chloé", nom: "Petit", email: "chloe@test.fr", telephone: "06 42 34 56 78", niveau: "Natation", notes: "Travail cardio." },
];

const PREVIEW_COURS: Cours[] = [
  { id: "c1", organisation_id: ORGANISATION_ID, titre: "Cardio Training", jour_semaine: "Vendredi", date_cours: "2026-06-05", heure_debut: "18:00", heure_fin: "19:00", lieu: "Stade rugby", tarif: 20, capacite_max: 8, week_offset: 0 },
  { id: "c2", organisation_id: ORGANISATION_ID, titre: "Renforcement", jour_semaine: "Samedi", date_cours: "2026-06-06", heure_debut: "10:00", heure_fin: "11:00", lieu: "Salle A", tarif: 20, capacite_max: 6, week_offset: 0 },
  { id: "c3", organisation_id: ORGANISATION_ID, titre: "Yoga", jour_semaine: "Dimanche", date_cours: "2026-06-07", heure_debut: "09:00", heure_fin: "10:00", lieu: "Salle de danse", tarif: 15, capacite_max: 10, week_offset: 0 },
  { id: "c4", organisation_id: ORGANISATION_ID, titre: "HIIT Training", jour_semaine: "Lundi", date_cours: "2026-06-08", heure_debut: "18:00", heure_fin: "19:00", lieu: "Salle B", tarif: 20, capacite_max: 10, week_offset: 0 },
];

const PREVIEW_RESERVATIONS: Reservation[] = [
  { id: "r1", organisation_id: ORGANISATION_ID, cours_id: "c1", sportif_id: "s1", statut: "active" },
  { id: "r2", organisation_id: ORGANISATION_ID, cours_id: "c1", sportif_id: "s2", statut: "active" },
  { id: "r3", organisation_id: ORGANISATION_ID, cours_id: "c1", sportif_id: "s3", statut: "active" },
  { id: "r4", organisation_id: ORGANISATION_ID, cours_id: "c1", sportif_id: "s4", statut: "active" },
  { id: "r5", organisation_id: ORGANISATION_ID, cours_id: "c1", sportif_id: "s1", statut: "active" },
  { id: "r6", organisation_id: ORGANISATION_ID, cours_id: "c2", sportif_id: "s2", statut: "active" },
  { id: "r7", organisation_id: ORGANISATION_ID, cours_id: "c2", sportif_id: "s3", statut: "active" },
  { id: "r8", organisation_id: ORGANISATION_ID, cours_id: "c3", sportif_id: "s4", statut: "active" },
];

const PREVIEW_DEMANDES: DemandeCreneau[] = [
  { id: "d1", organisation_id: ORGANISATION_ID, sportif_id: "s1", jour_souhaite: "Mardi", message: "Possible d'avoir un créneau cardio ?", statut: "en_attente", created_at: new Date().toISOString() },
  { id: "d2", organisation_id: ORGANISATION_ID, sportif_id: "s3", jour_souhaite: "Jeudi", message: "Besoin d'une séance renfo.", statut: "acceptee", created_at: new Date().toISOString() },
];

const PREVIEW_NOTIFICATIONS: NotificationCoach[] = [
  { id: "n1", organisation_id: ORGANISATION_ID, sportif_id: "s1", type: "reservation", titre: "Nouvelle réservation", message: "Lucas Martin s'est inscrit à Cardio Training.", lu: false, created_at: new Date().toISOString() },
  { id: "n2", organisation_id: ORGANISATION_ID, sportif_id: "s2", type: "annulation", titre: "Annulation", message: "Emma Dupont a annulé sa réservation.", lu: false, created_at: new Date().toISOString() },
  { id: "n3", organisation_id: ORGANISATION_ID, sportif_id: "s3", type: "rappel", titre: "Rappel", message: "Renforcement commence dans 24h.", lu: true, created_at: new Date().toISOString() },
];

const css = `
:root{
  --bg:#071019;
  --bg2:#0d1a24;
  --card:#111e27;
  --card2:#162733;
  --txt:#f6fbff;
  --muted:#92a1ad;
  --green:#a7ff16;
  --green2:#6fd400;
  --greenSoft:rgba(167,255,22,.14);
  --red:#ff4d5d;
  --redSoft:rgba(255,77,93,.14);
  --orange:#f5a623;
  --border:rgba(167,255,22,.22);
  --line:rgba(255,255,255,.08);
  --shadow:0 18px 45px rgba(0,0,0,.28);
}
*{box-sizing:border-box}
html,body,#root{min-height:100%;height:auto;overflow-y:auto;}
body{
  margin:0;
  background:
    radial-gradient(circle at 20% 0%,rgba(167,255,22,.020),transparent 34%),
    linear-gradient(180deg,#020202 0%,#010101 48%,#000000 100%);
  color:var(--txt);
  font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
  overflow-x:hidden;
  overflow-y:auto;
}
button,input,select,textarea{font:inherit}
button{touch-action:manipulation}

/* ===== APPLICATION INTERIEURE CR DARK V2 - MODE TEST SCROLL LIBRE ===== */
.app{
  min-height:100dvh;
  height:auto;
  width:min(100%,560px);
  margin:0 auto;
  padding:58px 16px 28px;
  overflow-x:hidden;
  background:
    radial-gradient(circle at 86px 54px,rgba(167,255,22,.020),transparent 44%),
    linear-gradient(180deg,#020202 0%,#010101 52%,#000000 100%);
  position:relative;
  overflow:visible;
}
.app::before{
  content:"";
  position:absolute;
  top:-90px;right:-90px;
  width:300px;height:300px;
  border-radius:50%;
  border:2px solid rgba(167,255,22,.24);
  transform:rotate(-25deg);
  pointer-events:none;
}
.top{
  position:relative;
  z-index:1;
  display:flex;
  justify-content:space-between;
  gap:14px;
  align-items:flex-start;
  margin-bottom:22px;
}
.brand{display:flex;gap:12px;align-items:flex-start;min-width:0;}
.logo{
  width:78px;height:58px;
  border-radius:18px;
  background:transparent;
  border:0;
  display:grid;
  place-items:center;
  flex:0 0 auto;
  overflow:visible;
}
.logo img{filter:drop-shadow(0 0 14px rgba(167,255,22,.32));}
.title{
  margin-top:8px;
  font-size:clamp(25px,7vw,36px);
  line-height:.95;
  text-transform:uppercase;
  font-weight:950;
  letter-spacing:-.8px;
  color:var(--txt);
  text-shadow:0 8px 24px rgba(0,0,0,.45);
}
.title::first-letter{color:var(--txt)}
.sub{
  margin-top:8px;
  color:var(--green);
  font-size:15px;
  font-weight:600;
}
.top > div:last-child{display:flex!important;flex-direction:column;gap:10px!important;align-items:flex-end;}
.pill{padding:8px 12px;border-radius:999px;background:#0b1d3b;border:1px solid var(--border);color:var(--muted);font-size:13px}
.btn{
  border:1px solid rgba(167,255,22,.38);
  border-radius:16px;
  padding:11px 14px;
  background:linear-gradient(135deg,var(--green),var(--green2));
  color:#071019;
  font-weight:850;
  cursor:pointer;
  box-shadow:0 10px 22px rgba(111,212,0,.18);
}
.btn.secondary{
  background:rgba(255,255,255,.035);
  color:#f4fbff;
  border:1px solid rgba(255,255,255,.18);
  box-shadow:none;
}
.top .btn.secondary{min-width:150px;color:#f6fbff;border-color:rgba(167,255,22,.35);}
.btn.red{
  background:rgba(255,77,93,.08);
  border:1px solid rgba(255,77,93,.75);
  color:#ff6f7c;
  box-shadow:none;
}
.btn.green{background:rgba(167,255,22,.13);color:var(--green);border-color:rgba(167,255,22,.7);box-shadow:none}
.btn:disabled{opacity:.55;cursor:not-allowed}

.grid{
  position:relative;
  z-index:1;
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:10px;
  margin:6px 0 22px;
}
.kpi{
  background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));
  border:1px solid var(--border);
  border-radius:16px;
  padding:14px 8px;
  min-height:108px;
  text-align:center;
  box-shadow:inset 0 0 24px rgba(167,255,22,.035),0 10px 25px rgba(0,0,0,.22);
}
.kpi b{display:block;font-size:28px;line-height:1.05;color:#fff;font-weight:950;}
.kpi span{display:block;color:#c8d0d8;font-size:12px;line-height:1.25;margin-top:7px;}
.kpi::before{
  content:"";
  display:block;
  width:34px;height:34px;
  margin:0 auto 9px;
  border-radius:12px;
  background:rgba(167,255,22,.10);
  box-shadow:inset 0 0 0 1px rgba(167,255,22,.18);
}
.section-title{
  position:relative;
  z-index:1;
  font-weight:950;
  margin:24px 0 18px;
  font-size:24px;
  letter-spacing:-.4px;
}
.section-title::after{
  content:"";
  display:block;
  width:36px;height:3px;
  margin-top:8px;
  border-radius:999px;
  background:var(--green);
  box-shadow:0 0 14px rgba(167,255,22,.65);
}
.row-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:6px;}
.row-title .btn{padding:9px 12px;font-size:13px;border-radius:14px;}
.cards{display:grid;gap:14px;position:relative;z-index:1;}
.course,.person,.notif-card,.list-item{
  background:linear-gradient(180deg,rgba(5,5,5,.98),rgba(1,1,1,.99));
  border:1px solid rgba(167,255,22,.12);
  border-radius:22px;
  padding:16px;
  box-shadow:0 14px 34px rgba(0,0,0,.45),inset 0 0 30px rgba(167,255,22,.014);
  backdrop-filter:blur(8px);
}
.course{position:relative;overflow:hidden;}
.course::after{
  content:"🏃";
  position:absolute;
  right:16px;top:74px;
  font-size:74px;
  opacity:.045;
  filter:grayscale(1);
  pointer-events:none;
}
.course-head,.person-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;position:relative;z-index:1;}
.course h3,.person h3{margin:0 0 8px;font-size:21px;line-height:1.12;font-weight:950;letter-spacing:-.3px;}
.meta{color:#c4cdd5;font-size:13px;line-height:1.5;}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;position:relative;z-index:1;}
.badge{
  padding:7px 10px;
  background:rgba(167,255,22,.08);
  border:1px solid rgba(167,255,22,.25);
  border-radius:999px;
  color:var(--green);
  font-size:13px;
  font-weight:850;
}
.badge.green{background:rgba(167,255,22,.13);color:var(--green);}
.bar{height:9px;background:rgba(255,255,255,.10);border-radius:999px;overflow:hidden;margin-top:14px;position:relative;z-index:1;}
.fill{height:100%;background:linear-gradient(90deg,var(--green2),var(--green));border-radius:999px;box-shadow:0 0 12px rgba(167,255,22,.6);}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;position:relative;z-index:1;}
.actions .btn{flex:1 1 0;min-width:118px;min-height:56px;border-radius:18px;}
.avatar{
  width:48px;height:48px;
  border-radius:50%;
  display:grid;place-items:center;
  background:linear-gradient(135deg,rgba(167,255,22,.18),rgba(255,255,255,.06));
  color:var(--green);
  border:1px solid rgba(167,255,22,.35);
  font-weight:950;
  box-shadow:0 0 16px rgba(167,255,22,.16);
}
.person-left{display:flex;gap:13px;align-items:center;}
.notif-dot{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:22px;height:22px;padding:0 6px;margin-left:6px;
  border-radius:999px;background:#ff3048;color:white;
  font-size:12px;font-weight:950;box-shadow:0 0 14px rgba(255,48,72,.5);
}
.notif-card{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;}
.notif-card.unread{border-color:rgba(255,77,93,.75);box-shadow:0 0 0 1px rgba(255,77,93,.25),var(--shadow);}
.notif-date{color:var(--muted);font-size:12px;margin-top:6px}


.notifications-toolbar{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:12px;
  flex-wrap:wrap;
}
.notifications-toolbar .btn{
  min-height:46px;
  border-radius:18px;
  padding:11px 14px;
}
.notif-card{
  min-height:96px;
  align-items:center;
}
.notif-card h3{
  margin:0 0 8px!important;
  font-size:20px;
  line-height:1.15;
  font-weight:950;
}
.notif-card .actions{
  min-width:120px;
  justify-content:flex-end;
}
.btn.danger-outline{
  background:rgba(255,77,93,.08);
  border:1px solid rgba(255,77,93,.75);
  color:#ff6f7c;
  box-shadow:none;
}
@media(max-width:520px){
  .row-title.notifications-title{align-items:flex-start;}
  .notifications-toolbar{width:100%;justify-content:stretch;}
  .notifications-toolbar .btn{flex:1 1 100%;}
  .notif-card{align-items:flex-start;flex-direction:column;}
  .notif-card .actions{width:100%;min-width:0;justify-content:flex-start;}
}

.tabs{
  position:relative;
  left:auto;right:auto;bottom:auto;
  z-index:50;
  display:flex;justify-content:center;
  padding:14px 12px 22px;
  background:transparent;
  border-top:0;
}
.tabs-inner{
  display:flex;
  gap:4px;
  width:min(560px,100%);
  padding:8px;
  border-radius:24px;
  background:rgba(15,25,34,.92);
  border:1px solid rgba(255,255,255,.10);
  box-shadow:0 -10px 35px rgba(0,0,0,.35),inset 0 0 20px rgba(255,255,255,.02);
  backdrop-filter:blur(16px);
}
.tab{
  flex:1;
  padding:10px 5px;
  min-height:62px;
  text-align:center;
  color:#87919a;
  cursor:pointer;
  font-size:12px;
  font-weight:750;
  border-radius:18px;
}
.tab.active{
  color:var(--green);
  background:rgba(167,255,22,.10);
  outline:1px solid rgba(167,255,22,.45);
  box-shadow:inset 0 0 18px rgba(167,255,22,.08),0 0 16px rgba(167,255,22,.11);
}
.week-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 14px;position:relative;z-index:1;}
.week-nav .btn{padding:9px 12px;border-radius:14px;min-width:44px;}
.week-label{flex:1;text-align:center;color:#dce7ee;font-weight:850;font-size:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:10px 8px;}
.demandes-switch{display:flex;gap:8px;margin:0 0 14px;position:relative;z-index:1;}
.demandes-switch .btn{flex:1;box-shadow:none;}

.floating{
  position:static;
  display:flex;
  align-items:center;
  justify-content:center;
  margin:18px 18px 8px auto;
  width:62px;height:62px;
  border-radius:50%;
  border:1px solid rgba(255,255,255,.25);
  background:linear-gradient(135deg,var(--green),var(--green2));
  color:#061016;
  font-size:38px;
  font-weight:500;
  z-index:1;
  box-shadow:0 0 0 9px rgba(167,255,22,.08),0 0 28px rgba(167,255,22,.45);
}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.82);display:grid;place-items:end center;z-index:100;padding:0 10px;}
.modal{
  width:min(560px,100%);max-height:92dvh;overflow:auto;
  background:linear-gradient(180deg,#050505,#000000);
  border:1px solid rgba(167,255,22,.20);
  border-radius:24px 24px 0 0;
  padding:22px;
  box-shadow:0 -24px 80px rgba(0,0,0,.55);
}
.modal h2{margin:0 0 16px;font-size:23px;}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.field{display:flex;flex-direction:column;gap:7px;margin:12px 0;}
.field label{color:#dbe3e9;font-size:14px;font-weight:800;}
.field input,.field select,.field textarea{
  background:#0d1922;color:white;border:1px solid rgba(255,255,255,.12);
  border-radius:14px;padding:12px;outline:none;
}
.field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(167,255,22,.65);box-shadow:0 0 0 3px rgba(167,255,22,.08);}
.list{display:grid;gap:10px;}
.toast{position:fixed;right:14px;bottom:105px;z-index:200;padding:12px 14px;border-radius:14px;max-width:420px;font-weight:800;}
.toast.ok{background:#12351b;border:1px solid var(--green);color:#eaffd0}.toast.err{background:#351218;border:1px solid #ff5c70;color:#ffd8dd}

@media(max-width:760px){
 .app{padding-left:14px;padding-right:14px;padding-top:58px;padding-bottom:28px;}
  .grid{grid-template-columns:repeat(4,1fr);gap:8px;}
  .kpi{padding:12px 5px;min-height:104px}.kpi b{font-size:25px}.kpi span{font-size:11px}
  .two{grid-template-columns:1fr}.title{font-size:clamp(24px,8vw,34px)}
  .actions .btn{min-width:0;font-size:13px;padding:10px 8px;}
}
@media(max-width:430px){
  .top{gap:8px}.logo{width:68px;height:52px}.sub{font-size:13px}
  .top .btn.secondary,.top .btn.red{min-width:124px;font-size:13px;padding:10px 10px;}
  .grid{gap:7px}.kpi{border-radius:14px;min-height:96px}.kpi b{font-size:23px}.kpi span{font-size:10.5px}
  .course,.person,.notif-card{padding:14px;border-radius:20px}.course h3,.person h3{font-size:19px}
}


/* ===== DASHBOARD PREMIUM V2 CR - BLACK PREMIUM ===== */
.app{
  padding:24px 16px 28px;
  background:
    radial-gradient(circle at 88% 2%,rgba(167,255,22,.035),transparent 30%),
    radial-gradient(circle at 10% 12%,rgba(167,255,22,.018),transparent 34%),
    linear-gradient(180deg,#020202 0%,#010101 54%,#000000 100%);
}
.pmagalieum-header{
  position:relative;
  z-index:2;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  margin:4px 0 18px;
}
.pmagalieum-brand{display:flex;align-items:center;gap:12px;min-width:0;}
.pmagalieum-logo{
  width:58px;height:58px;
  border-radius:20px;
  background:rgba(3,3,3,.94);
  border:1px solid rgba(167,255,22,.16);
  display:grid;place-items:center;
  overflow:hidden;
  box-shadow:0 12px 30px rgba(0,0,0,.28),0 0 22px rgba(167,255,22,.10);
}
.pmagalieum-logo img{width:100%;height:100%;object-fit:cover;display:block;}
.pmagalieum-eyebrow{font-size:12px;color:var(--green);font-weight:800;letter-spacing:.6px;text-transform:uppercase;}
.pmagalieum-mini{font-size:12px;color:#9ca9b3;margin-top:3px;font-weight:600;}
.pmagalieum-actions{display:flex;align-items:center;gap:9px;flex:0 0 auto;}
.icon-btn{
  width:44px;height:44px;
  border-radius:16px;
  border:1px solid rgba(167,255,22,.22);
  background:rgba(2,2,2,.92);
  color:#eef8ee;
  display:grid;place-items:center;
  font-size:18px;
  cursor:pointer;
  position:relative;
  box-shadow:inset 0 0 18px rgba(167,255,22,.025),0 10px 22px rgba(0,0,0,.18);
}
.icon-btn.plus{
  background:linear-gradient(135deg,rgba(167,255,22,.90),rgba(111,212,0,.85));
  color:#071019;
  font-size:28px;
  font-weight:600;
  border-color:rgba(167,255,22,.55);
  box-shadow:0 0 0 7px rgba(167,255,22,.06),0 14px 32px rgba(111,212,0,.20);
}
.icon-badge{
  position:absolute;
  top:-5px;right:-5px;
  min-width:19px;height:19px;padding:0 5px;
  border-radius:999px;
  background:#ff3048;color:white;
  font-size:11px;font-weight:950;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 12px rgba(255,48,72,.45);
}
.pmagalieum-hero{
  position:relative;
  z-index:1;
  margin:0 0 18px;
  padding:18px;
  border-radius:28px;
  background:linear-gradient(180deg,rgba(5,5,5,.98),rgba(0,0,0,.99));
  border:1px solid rgba(167,255,22,.13);
  box-shadow:0 18px 45px rgba(0,0,0,.45),inset 0 0 35px rgba(167,255,22,.020);
  overflow:hidden;
}
.pmagalieum-hero::after{
  content:"";
  position:absolute;
  width:130px;height:130px;
  right:-50px;top:-45px;
  border-radius:50%;
  border:1px solid rgba(167,255,22,.14);
  box-shadow:0 0 40px rgba(167,255,22,.055);
}
.hello-title{
  position:relative;
  z-index:1;
  margin:0;
  font-size:26px;
  line-height:1.05;
  font-weight:950;
  letter-spacing:-.6px;
}
.hello-sub{
  position:relative;
  z-index:1;
  margin-top:7px;
  color:#a9b5be;
  font-size:14px;
  font-weight:600;
}
.hero-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;position:relative;z-index:1;}
.hero-tools .btn{min-height:40px;padding:9px 12px;border-radius:14px;font-size:13px;box-shadow:none;}
.pmagalieum-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
  margin:0 0 22px;
}
.kpi.pmagalieum-kpi{
  min-height:118px;
  text-align:left;
  padding:15px;
  border-radius:24px;
  background:linear-gradient(180deg,rgba(5,5,5,.98),rgba(1,1,1,.99));
  border:1px solid rgba(167,255,22,.12);
  box-shadow:0 14px 32px rgba(0,0,0,.46),inset 0 0 30px rgba(167,255,22,.014);
}
.kpi.pmagalieum-kpi::before{display:none;}
.kpi-icon{
  width:38px;height:38px;
  border-radius:15px;
  display:grid;place-items:center;
  background:rgba(167,255,22,.085);
  border:1px solid rgba(167,255,22,.15);
  margin-bottom:12px;
  font-size:18px;
}
.kpi.pmagalieum-kpi b{font-size:28px;line-height:1;font-weight:950;}
.kpi.pmagalieum-kpi span{font-size:13px;color:#c9d3da;margin-top:6px;font-weight:750;}
.kpi-trend{font-size:11px;color:#8f9ba5;margin-top:6px;font-weight:650;}

.sportif-quick-actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
  margin:0 0 22px;
}
.sportif-quick-actions .btn{
  min-height:48px;
  border-radius:18px;
  box-shadow:none;
}
@media(max-width:430px){
  .sportif-quick-actions{grid-template-columns:1fr;gap:8px;}
}


.mobile-planner-card{
  margin:0 0 18px;
  padding:16px;
  border-radius:24px;
  background:linear-gradient(180deg,rgba(4,4,4,.99),rgba(0,0,0,1));
  border:1px solid rgba(167,255,22,.12);
  box-shadow:0 16px 36px rgba(0,0,0,.50),inset 0 0 28px rgba(167,255,22,.014);
  overflow:hidden;
}
.mobile-planner-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:14px;
}
.mobile-planner-title{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:21px;
  font-weight:950;
  letter-spacing:-.4px;
}
.mobile-planner-title-icon{
  width:32px;
  height:32px;
  border-radius:12px;
  display:grid;
  place-items:center;
  color:var(--green);
  border:1px solid rgba(167,255,22,.22);
  background:rgba(167,255,22,.08);
}
.mobile-planner-actions{
  display:flex;
  gap:8px;
  align-items:center;
}
.mobile-planner-actions .btn{
  min-height:38px;
  padding:8px 11px;
  font-size:13px;
  border-radius:13px;
  box-shadow:none;
}
.week-picker{
  display:flex;
  align-items:center;
  gap:8px;
  margin:0 0 12px;
}
.week-picker .btn{
  min-width:42px;
  min-height:40px;
  padding:8px 10px;
  border-radius:14px;
  box-shadow:none;
}
.week-picker-label{
  flex:1;
  min-height:40px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:14px;
  border:1px solid rgba(167,255,22,.13);
  background:rgba(2,2,2,.92);
  color:#dce7ee;
  font-size:13px;
  font-weight:850;
  text-align:center;
}
.week-days{
  display:grid;
  grid-template-columns:repeat(7,1fr);
  gap:6px;
  padding-left:34px;
  margin-bottom:8px;
}
.day-chip{
  min-height:48px;
  border-radius:13px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(2,2,2,.94);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  font-size:12px;
  font-weight:850;
  color:#f4fbff;
}
.day-chip.today{
  background:linear-gradient(135deg,rgba(167,255,22,.95),rgba(111,212,0,.82));
  color:#071019;
  border-color:rgba(167,255,22,.65);
}
.planner-grid{
  position:relative;
  height:360px;
  padding-left:34px;
  border-radius:18px;
  overflow:hidden;
  background:
    linear-gradient(90deg,rgba(255,255,255,.040) 1px,transparent 1px),
    linear-gradient(180deg,rgba(255,255,255,.050) 1px,transparent 1px),
    rgba(0,0,0,.82);
  background-size:calc((100% - 34px) / 7) 100%,100% 48px;
  background-position:34px 0,0 18px;
}
.time-col{
  position:absolute;
  left:0;
  top:10px;
  width:30px;
  display:grid;
  gap:24px;
  color:#c8d0d8;
  font-size:12px;
  font-weight:700;
}
.planner-event{
  position:absolute;
  width:11.7%;
  min-height:54px;
  padding:7px 7px;
  border-radius:11px;
  background:linear-gradient(180deg,rgba(105,190,0,.86),rgba(54,108,0,.76));
  border:1px solid rgba(167,255,22,.32);
  color:#fff;
  box-shadow:0 10px 20px rgba(0,0,0,.24),0 0 15px rgba(167,255,22,.10);
  cursor:pointer;
  overflow:hidden;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:4px;
  text-align:center;
}
.planner-event.long{
  padding:10px 7px 28px;
}
.planner-event.alt{
  background:linear-gradient(180deg,rgba(5,5,5,.98),rgba(0,0,0,.99));
}
.planner-event-time{
  font-size:11px;
  font-weight:900;
  line-height:1.15;
}
.planner-event-title{
  margin-top:0;
  font-size:11px;
  line-height:1.15;
  font-weight:850;
  display:-webkit-box;
  -webkit-line-clamp:3;
  -webkit-box-orient:vertical;
  overflow:hidden;
}
.planner-event-duration{
  position:absolute;
  left:50%;
  bottom:7px;
  transform:translateX(-50%);
  padding:3px 7px;
  border-radius:999px;
  background:rgba(0,0,0,.35);
  border:1px solid rgba(255,255,255,.16);
  color:#fff;
  font-size:10px;
  font-weight:950;
  line-height:1;
  white-space:nowrap;
}
.planner-empty{
  position:absolute;
  left:46px;
  right:12px;
  top:112px;
}
@media(max-width:430px){
  .mobile-planner-card{padding:14px;border-radius:22px;}
  .mobile-planner-title{font-size:20px;}
  .week-days{gap:5px;padding-left:30px;}
  .day-chip{font-size:11px;min-height:46px;}
  .planner-grid{height:360px;padding-left:30px;background-position:30px 0,0 18px;}
  .time-col{width:27px;font-size:11px;}
  .planner-event{width:11.5%;padding:6px 5px;}
  .planner-event-time,.planner-event-title{font-size:10px;}
}


.empty-state{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  min-height:92px;
  padding:18px;
  border-radius:22px;
  background:linear-gradient(180deg,rgba(5,5,5,.98),rgba(1,1,1,.99));
  border:1px solid rgba(167,255,22,.12);
  color:#f6fbff;
  font-size:15px;
  font-weight:750;
  text-align:center;
  box-shadow:0 12px 28px rgba(0,0,0,.42),inset 0 0 24px rgba(167,255,22,.014);
}
.empty-state-icon{
  width:34px;
  height:34px;
  flex:0 0 34px;
  border-radius:14px;
  display:grid;
  place-items:center;
  background:rgba(167,255,22,.09);
  border:1px solid rgba(167,255,22,.16);
  font-size:17px;
}
.empty-state-text{
  line-height:1.35;
}

.section-title{font-size:22px;margin:22px 0 14px;}
.course,.person,.notif-card,.list-item{
  border-radius:24px;
  background:linear-gradient(180deg,rgba(5,5,5,.98),rgba(1,1,1,.99));
  border-color:rgba(167,255,22,.12);
}
.week-label{background:rgba(255,255,255,.045);border-color:rgba(167,255,22,.13);}
.tabs{padding:12px 12px 18px;}
.tabs-inner{border-radius:26px;background:rgba(0,0,0,.97);border-color:rgba(167,255,22,.10);}
.tab.active{color:var(--green);background:rgba(167,255,22,.09);outline:1px solid rgba(167,255,22,.30);}
body .floating{display:none;}
@media(max-width:430px){
  .app{padding:18px 13px 24px;}
  .pmagalieum-logo{width:54px;height:54px;border-radius:18px;}
  .pmagalieum-actions{gap:7px;}
  .icon-btn{width:41px;height:41px;border-radius:15px;}
  .hello-title{font-size:24px;}
  .pmagalieum-hero{padding:16px;border-radius:26px;}
  .pmagalieum-grid{gap:10px;}
  .kpi.pmagalieum-kpi{min-height:112px;padding:14px;border-radius:22px;}
  .kpi.pmagalieum-kpi b{font-size:26px;}
}

/* ===== PAGE CONNEXION IMAGE OFFICIELLE CR - VERSION SANS CHOIX COACH/SPORTIF ===== */
.auth{
  min-height:100vh;
  width:100%;
  display:flex;
  justify-content:center;
  align-items:flex-start;
  padding:0;
  background:#02070d;
  overflow:auto;
}
.auth-poster{
  position:relative;
  width:min(100vw,520px);
  aspect-ratio:1024/1536;
  min-height:auto;
  background:#02070d;
  overflow:hidden;
  box-shadow:0 0 70px rgba(0,0,0,.55);
}
.auth-poster-img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
  user-select:none;
  pointer-events:none;
}
.auth-zone{
  position:absolute;
  z-index:5;
  margin:0;
  padding:0;
  color:transparent;
  background:transparent;
  border:0;
  box-shadow:none;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.auth-zone.coach,.auth-zone.sportif{
  background:transparent;
  border:0;
  box-shadow:none;
}
.auth-zone.role-selected{
  background:rgba(167,255,22,.30);
  border:1px solid rgba(167,255,22,.70);
  box-shadow:
    inset 0 0 16px rgba(167,255,22,.14),
    0 0 10px rgba(167,255,22,.14);
}
.auth-zone.role-selected::after{
  display:none;
}
.auth-role-icon{display:none;}
.auth-zone:focus,
.auth-zone:focus-visible,
.auth-real-input:focus,
.auth-real-input:focus-visible{
  outline:none!important;
  box-shadow:none!important;
}
.auth-zone.coach{left:17.8%;top:36.2%;width:28.2%;height:6.0%;border-radius:22px;}
.auth-zone.sportif{left:52.8%;top:36.2%;width:28.2%;height:6.0%;border-radius:22px;}
.auth-real-input{
  position:absolute;
  z-index:4;
  left:18.6%;
  width:65.4%;
  height:5.2%;
  border:0!important;
  outline:none!important;
  background:transparent!important;
  box-shadow:none!important;
  color:rgba(255,255,255,.72);
  font-size:clamp(20px,4vw,24px);
  font-weight:300!important;
  letter-spacing:.2px;
  line-height:1!important;
  padding:0!important;
  margin:0!important;
  text-align:left;
  text-shadow:none!important;
  caret-color:transparent!important;
  appearance:none;
  -webkit-appearance:none;
  -webkit-text-fill-color:rgba(255,255,255,.72);
}
.auth-real-input::placeholder{color:transparent!important;opacity:0!important;}
.auth-real-input.email{top:55.35%;left:24%;width:59%;}
.auth-real-input.password{top:74.05%;left:24%;width:49%;}
.auth-zone.eye{left:79.0%;top:75.2%;width:8.5%;height:5.8%;border-radius:50%;}
.auth-zone.submit{left:13.5%;top:89.2%;width:73.0%;height:7.6%;border-radius:26px;}
.auth-zone.forgot{left:56%;top:84.0%;width:31%;height:4.0%;border-radius:18px;}
.auth-zone.contact{left:18%;top:97.0%;width:64%;height:3.0%;border-radius:18px;}
.auth-status-floating{
  position:absolute;
  left:10%;
  right:10%;
  bottom:2.0%;
  z-index:8;
  padding:10px 12px;
  border-radius:14px;
  text-align:center;
  font-size:13px;
  font-weight:700;
  line-height:1.35;
  backdrop-filter:blur(10px);
}
.auth-status-floating.ok{background:rgba(18,53,27,.82);border:1px solid rgba(167,255,22,.7);color:#eaffd0;}
.auth-status-floating.err{background:rgba(53,18,24,.86);border:1px solid rgba(255,92,112,.75);color:#ffd8dd;}

.auth-reset-card{
  width:min(92vw,430px);
  margin:80px auto 0;
  padding:24px;
  border-radius:26px;
  background:linear-gradient(180deg,rgba(18,32,42,.96),rgba(5,10,15,.98));
  border:1px solid rgba(167,255,22,.28);
  box-shadow:0 24px 80px rgba(0,0,0,.55),inset 0 0 28px rgba(167,255,22,.035);
}
.auth-reset-card h1{margin:0 0 8px;font-size:26px;line-height:1.1;letter-spacing:-.4px;}
.auth-reset-card p{margin:0 0 18px;color:#c4cdd5;line-height:1.45;font-size:14px;}
.auth-reset-field{display:flex;flex-direction:column;gap:7px;margin:14px 0;}
.auth-reset-field label{font-size:13px;font-weight:850;color:#dbe3e9;}
.auth-reset-field input{
  background:#0d1922;color:white;border:1px solid rgba(167,255,22,.28);
  border-radius:16px;padding:14px;outline:none;
}
.auth-reset-field input:focus{border-color:rgba(167,255,22,.75);box-shadow:0 0 0 3px rgba(167,255,22,.09);}
.auth-reset-actions{display:flex;gap:10px;margin-top:18px;}
.auth-reset-actions .btn{flex:1;min-height:52px;}
.auth-reset-note{margin-top:14px;color:#92a1ad;font-size:12px;line-height:1.4;}

.auth-loading{
  min-height:100vh;
  display:grid;
  place-items:center;
  color:#fff;
  font-weight:700;
  background:#02070d;
}
@media(min-width:700px){
  .auth{padding:18px 0;}
  .auth-poster{border-radius:0;}
}
@media(max-width:520px){
  .auth-poster{width:100vw;}
  .auth-real-input{
    font-size:20px!important;
    font-weight:300!important;
    color:rgba(255,255,255,.62)!important;
    -webkit-text-fill-color:rgba(255,255,255,.62)!important;
  }
}



input.auth-real-input:-webkit-autofill,
input.auth-real-input:-webkit-autofill:hover,
input.auth-real-input:-webkit-autofill:focus{
  -webkit-box-shadow:0 0 0 1000px transparent inset!important;
  -webkit-text-fill-color:rgba(255,255,255,.62)!important;
  transition:background-color 9999s ease-in-out 0s;
}


/* ===== CORRECTIONS VISUELLES REMI V1.1 - SANS TOUCHER AUX FONCTIONS ===== */
/* 1) Safe Area iPhone : évite que le contenu remonte dans l'encoche */
.app{
  padding-top:calc(env(safe-area-inset-top) + 24px)!important;
}

/* 2) Page de connexion : descend légèrement le visuel sous la barre iPhone */
.auth{
  padding-top:calc(env(safe-area-inset-top) + 12px)!important;
  align-items:flex-start!important;
}
.auth-poster{
  margin-top:0!important;
}

/* 3) Sécurité marges droites : évite les boutons coupés sur mobile */
.course,.person,.notif-card,.list-item{
  max-width:100%;
}
.actions{
  width:100%;
  padding-right:2px;
}
.actions .btn{
  min-width:0;
  white-space:nowrap;
}
.btn.red{
  white-space:nowrap;
}

/* 4) Planning : tous les cours / réservations visibles restent en vert, avec contour noir discret */
.planner-event,
.planner-event.alt{
  background:linear-gradient(180deg,rgba(167,255,22,.92),rgba(78,150,0,.86))!important;
  border:2px solid rgba(0,0,0,.82)!important;
  color:#ffffff!important;
  box-shadow:0 10px 20px rgba(0,0,0,.32),0 0 14px rgba(167,255,22,.14)!important;
}
.planner-event-time,
.planner-event-title{
  color:#ffffff!important;
  text-shadow:0 1px 2px rgba(0,0,0,.35);
}

@media(max-width:430px){
  .app{
    padding-top:calc(env(safe-area-inset-top) + 20px)!important;
  }
  .auth{
    padding-top:calc(env(safe-area-inset-top) + 10px)!important;
  }
  .actions{
    gap:8px;
    padding-right:0;
  }
  .actions .btn{
    padding-left:7px;
    padding-right:7px;
    font-size:12.5px;
  }
}

/* ===== CORRECTION V1.1 - CARTES DEMANDES DE CRENEAUX ===== */
.notif-card{
  overflow:hidden;
}
.notif-card > div:first-child{
  min-width:0;
  flex:1 1 auto;
}
.notif-card .actions{
  flex:0 0 auto;
  max-width:100%;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  flex-wrap:nowrap;
}
.notif-card .actions .btn{
  min-width:0;
  width:auto;
  max-width:190px;
  min-height:52px;
  padding:10px 14px;
  white-space:normal;
  line-height:1.12;
  text-align:center;
}
@media(max-width:760px){
  .notif-card{
    flex-direction:column;
    align-items:stretch;
  }
  .notif-card .actions{
    width:100%;
    min-width:0;
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
  }
  .notif-card .actions .btn{
    width:100%;
    max-width:none;
  }
}
@media(max-width:430px){
  .notif-card .actions{
    grid-template-columns:1fr;
  }
}


/* ===== CORRECTIONS V1.3 - RETOURS REMI : COACH & PLANNING + MOBILE SPORTIFS ===== */
/* Recadrage haut image : garde la tête complète autant que possible */
.auth-poster-img{
  object-position:center top!important;
}

/* Masque le texte intégré dans l'image de connexion et affiche le nouveau nom */
.auth-title-patch{
  position:absolute;
  z-index:6;
  left:17%;
  right:17%;
  top:25.8%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  pointer-events:none;
  text-align:center;
}
.auth-title-patch::before{
  content:"";
  position:absolute;
  inset:-14px -28px -48px;
  border-radius:20px;
  background:linear-gradient(180deg,rgba(0,0,0,.92),rgba(0,0,0,.86));
  filter:blur(.2px);
}
.auth-title-main,
.auth-title-sub{
  position:relative;
  z-index:1;
}
.auth-title-main{
  font-size:clamp(22px,5.2vw,31px);
  line-height:1;
  font-weight:850;
  color:#f6fbff;
  letter-spacing:-.4px;
}
.auth-title-main span{
  color:var(--green);
}
.auth-title-sub{
  margin-top:8px;
  padding:0;
  border:none;
  border-radius:0;
  color:#d7dde2;
  font-size:clamp(12px,2.55vw,15px);
  font-weight:600;
  background:transparent;
}

/* Cartes sportifs : empêche les boutons de déborder sans modifier la largeur générale */
.person{
  overflow:hidden;
}
.person-head{
  min-width:0;
}
.person-left{
  min-width:0;
  flex:1 1 auto;
}
.person-left > div:last-child{
  min-width:0;
}
.person h3,
.person .meta{
  overflow-wrap:anywhere;
  word-break:normal;
}
.person-head > .actions{
  flex:0 0 auto;
  width:auto;
  max-width:230px;
  margin-left:auto;
  flex-wrap:nowrap;
}
.person-head > .actions .btn{
  min-width:0;
  width:108px;
  max-width:108px;
  min-height:54px;
  padding-left:8px;
  padding-right:8px;
  font-size:13px;
}

@media(max-width:560px){
  .person-head{
    flex-direction:column;
    align-items:stretch;
    gap:14px;
  }
  .person-left{
    align-items:flex-start;
  }
  .person-head > .actions{
    width:100%;
    max-width:none;
    margin-left:0;
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
  }
  .person-head > .actions .btn{
    width:100%;
    max-width:none;
    min-height:52px;
    font-size:14px;
  }
}

@media(max-width:380px){
  .person-head > .actions{
    grid-template-columns:1fr;
  }
}



/* V1.3 FINAL - supprime le cadre blanc et masque l'ancien sous-titre de l'image */
.auth-title-patch::after{
  content:"";
  position:absolute;
  z-index:1;
  left:-18%;
  right:-18%;
  top:64%;
  height:74px;
  border-radius:18px;
  background:linear-gradient(180deg,rgba(0,0,0,.94),rgba(0,0,0,.88));
  pointer-events:none;
}
.auth-title-main,
.auth-title-sub{
  position:relative;
  z-index:3;
}




/* ===== V1.4 FINAL CLEAN LOGIN - IMAGE SANS CHAMPS + FORMULAIRE REACT ===== */
.auth{
  min-height:100vh!important;
  width:100%!important;
  max-width:100%!important;
  overflow-x:hidden!important;
  background:#02070d!important;
  display:flex!important;
  justify-content:center!important;
  align-items:flex-start!important;
  padding-top:calc(env(safe-area-inset-top) + 8px)!important;
}

.auth-poster{
  position:relative!important;
  width:100%!important;
  max-width:520px!important;
  aspect-ratio:1024/1536!important;
  min-height:auto!important;
  margin:0 auto!important;
  overflow:hidden!important;
  background:#02070d!important;
  border-radius:0!important;
  box-shadow:0 0 70px rgba(0,0,0,.55)!important;
}

.auth-poster-img{
  position:absolute!important;
  inset:0!important;
  width:100%!important;
  height:100%!important;
  object-fit:cover!important;
  object-position:center top!important;
  pointer-events:none!important;
  user-select:none!important;
  display:block!important;
}

.auth-title-patch,
.auth-zone.eye,
.auth-zone.submit,
.auth-zone.forgot,
.auth-zone.contact{
  display:none!important;
}

.auth-form-card{
  position:absolute!important;
  z-index:40!important;
  left:10%!important;
  right:10%!important;
  top:50.5%!important;
  display:flex!important;
  flex-direction:column!important;
  gap:9px!important;
}

.auth-field-label{
  color:#ffffff!important;
  font-size:14px!important;
  font-weight:650!important;
  margin:0 0 2px!important;
  line-height:1.2!important;
}

.auth-field-wrap{
  position:relative!important;
  width:100%!important;
}

.auth-field-icon{
  position:absolute!important;
  left:16px!important;
  top:50%!important;
  transform:translateY(-50%)!important;
  z-index:3!important;
  font-size:17px!important;
  pointer-events:none!important;
}

.auth-form-card .auth-real-input{
  position:relative!important;
  inset:auto!important;
  left:auto!important;
  top:auto!important;
  width:100%!important;
  height:58px!important;
  padding:0 18px 0 52px!important;
  border:1px solid rgba(167,255,22,.48)!important;
  border-radius:14px!important;
  background:rgba(0,0,0,.74)!important;
  color:#ffffff!important;
  -webkit-text-fill-color:#ffffff!important;
  font-size:16px!important;
  font-weight:500!important;
  line-height:58px!important;
  box-shadow:inset 0 0 18px rgba(167,255,22,.045)!important;
  caret-color:var(--green)!important;
  outline:none!important;
}

.auth-form-card .auth-real-input:focus{
  border-color:rgba(167,255,22,.82)!important;
  box-shadow:0 0 0 3px rgba(167,255,22,.08), inset 0 0 18px rgba(167,255,22,.05)!important;
}

.auth-form-card .auth-real-input::placeholder{
  color:rgba(255,255,255,.48)!important;
  opacity:1!important;
}

.auth-form-card .auth-real-input.password{
  padding-right:58px!important;
}

.auth-eye-btn{
  position:absolute!important;
  z-index:5!important;
  right:8px!important;
  top:50%!important;
  transform:translateY(-50%)!important;
  width:46px!important;
  height:46px!important;
  border:0!important;
  background:transparent!important;
  color:rgba(255,255,255,.74)!important;
  font-size:17px!important;
  cursor:pointer!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  padding:0!important;
}

.auth-options-row{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:10px!important;
  margin-top:2px!important;
  min-height:22px!important;
}

.auth-remember{
  display:flex!important;
  align-items:center!important;
  gap:7px!important;
  color:#ffffff!important;
  font-size:12px!important;
  font-weight:650!important;
  cursor:pointer!important;
  user-select:none!important;
  margin:0!important;
  white-space:nowrap!important;
}

.auth-remember input{
  appearance:auto!important;
  -webkit-appearance:checkbox!important;
  width:14px!important;
  height:14px!important;
  min-width:14px!important;
  accent-color:var(--green)!important;
  margin:0!important;
  opacity:1!important;
  display:block!important;
}

.auth-forgot-btn{
  border:0!important;
  background:transparent!important;
  color:var(--green)!important;
  font-size:12px!important;
  font-weight:750!important;
  padding:0!important;
  cursor:pointer!important;
  white-space:nowrap!important;
}

.auth-submit-btn{
  width:100%!important;
  height:64px!important;
  margin-top:16px!important;
  border-radius:14px!important;
  background:linear-gradient(135deg,var(--green),#22c76a)!important;
  color:#061016!important;
  font-size:17px!important;
  font-weight:850!important;
  border:0!important;
  cursor:pointer!important;
  box-shadow:0 12px 28px rgba(0,0,0,.28)!important;
}

.auth-submit-btn:disabled{
  opacity:.65!important;
  cursor:not-allowed!important;
}

.auth-contact-btn{
  border:0!important;
  background:transparent!important;
  color:rgba(255,255,255,.68)!important;
  font-size:12px!important;
  font-weight:650!important;
  padding:4px 0 0!important;
  cursor:pointer!important;
}

.auth-status-floating{
  left:10%!important;
  right:10%!important;
  bottom:4.5%!important;
}

html,body,#root{
  width:100%!important;
  max-width:100%!important;
  overflow-x:hidden!important;
}

@media(max-width:520px){
  .auth-poster{
    width:100vw!important;
    max-width:100vw!important;
  }

  .auth-form-card{
    left:10%!important;
    right:10%!important;
    top:50.8%!important;
    gap:8px!important;
  }

  .auth-form-card .auth-real-input{
    height:56px!important;
    line-height:56px!important;
    font-size:16px!important;
  }

  .auth-submit-btn{
    height:62px!important;
    margin-top:15px!important;
  }

  .auth-options-row{
    gap:8px!important;
  }

  .auth-remember,
  .auth-forgot-btn{
    font-size:11.5px!important;
  }
}


/* ===== V1.15 - BOUTONS MODAL MODIFICATION COURS COMPACTS ===== */
.edit-course-actions{
  display:grid!important;
  grid-template-columns:1.15fr .85fr .95fr!important;
  gap:8px!important;
  width:100%!important;
  margin-top:16px!important;
  padding-right:0!important;
  align-items:stretch!important;
}

.edit-course-actions .btn{
  min-width:0!important;
  width:100%!important;
  max-width:none!important;
  min-height:46px!important;
  height:46px!important;
  padding:8px 8px!important;
  border-radius:16px!important;
  font-size:12.5px!important;
  line-height:1.05!important;
  white-space:nowrap!important;
  text-align:center!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
}

.edit-course-actions .edit-save-btn{
  font-weight:900!important;
}

.edit-course-actions .edit-cancel-btn{
  order:2;
}

.edit-course-actions .edit-delete-btn{
  order:3;
}

@media(max-width:380px){
  .edit-course-actions{
    grid-template-columns:1fr 1fr!important;
  }
  .edit-course-actions .edit-save-btn{
    grid-column:1 / -1!important;
  }
}


/* ===== V1.17 - PLANNING OPTION 2 : HAUTEUR LIMITEE + DUREE AFFICHEE ===== */
.planner-grid{
  height:390px!important;
}
.planner-event{
  min-height:58px!important;
  max-height:150px!important;
}
.planner-event.long{
  padding-bottom:30px!important;
}
.planner-event-title{
  -webkit-line-clamp:4!important;
}



/* ===== V1.20 - HEADER FORCE COACHING & RESERVATIONS ===== */
.pmagalieum-eyebrow{
  text-transform:none!important;
  letter-spacing:.4px!important;
}


/* ===== V1.21 - THEME MAGALIE PILATES ROSE / VIOLET ===== */
:root{
  --bg:#fff7fc!important;
  --bg2:#fbeaf6!important;
  --card:#ffffff!important;
  --card2:#fff2fa!important;
  --txt:#27313b!important;
  --muted:#7f6d7c!important;
  --green:#ec5fa8!important;
  --green2:#b875d6!important;
  --greenSoft:rgba(236,95,168,.14)!important;
  --red:#ef4d73!important;
  --redSoft:rgba(239,77,115,.12)!important;
  --border:rgba(236,95,168,.28)!important;
  --line:rgba(64,34,57,.10)!important;
}

/* Fond général clair, pastel et pmagalieum */
body{
  background:
    radial-gradient(circle at 10% 8%, rgba(236,95,168,.18), transparent 30%),
    radial-gradient(circle at 92% 4%, rgba(184,117,214,.18), transparent 34%),
    linear-gradient(180deg,#fff8fd 0%,#fff2fa 52%,#ffffff 100%)!important;
  color:#27313b!important;
}

/* Application complète */
.app{
  background:
    radial-gradient(circle at 12% 4%, rgba(236,95,168,.16), transparent 32%),
    radial-gradient(circle at 92% 0%, rgba(184,117,214,.15), transparent 30%),
    linear-gradient(180deg,#fff8fd 0%,#fff3fa 50%,#ffffff 100%)!important;
  color:#27313b!important;
}
.app::before{
  border-color:rgba(236,95,168,.22)!important;
  box-shadow:0 0 42px rgba(236,95,168,.08)!important;
}

/* Header */
.pmagalieum-header{
  background:rgba(255,255,255,.56)!important;
  border:1px solid rgba(236,95,168,.16)!important;
  border-radius:24px!important;
  padding:10px 12px!important;
  box-shadow:0 12px 30px rgba(184,117,214,.10)!important;
  backdrop-filter:blur(16px)!important;
}
.pmagalieum-logo{
  background:linear-gradient(135deg,rgba(236,95,168,.14),rgba(184,117,214,.12))!important;
  border-color:rgba(236,95,168,.26)!important;
  box-shadow:0 12px 28px rgba(236,95,168,.18)!important;
}
.pmagalieum-eyebrow{
  color:#2f3540!important;
  font-weight:900!important;
}
.pmagalieum-mini,
.hello-sub,
.kpi-trend,
.meta,
.notif-date{
  color:#7f6d7c!important;
}

/* Cartes */
.pmagalieum-hero,
.kpi.pmagalieum-kpi,
.course,
.person,
.notif-card,
.list-item,
.empty-state,
.mobile-planner-card,
.modal{
  background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,246,252,.96))!important;
  border:1px solid rgba(236,95,168,.18)!important;
  box-shadow:0 16px 38px rgba(184,117,214,.14), inset 0 0 26px rgba(255,255,255,.45)!important;
  color:#27313b!important;
}
.hello-title,
.section-title,
.course h3,
.person h3,
.notif-card h3,
.modal h2,
.kpi.pmagalieum-kpi b{
  color:#27313b!important;
  text-shadow:none!important;
}
.section-title::after{
  background:linear-gradient(90deg,#ec5fa8,#b875d6)!important;
  box-shadow:0 0 16px rgba(236,95,168,.38)!important;
}

/* KPI */
.kpi-icon,
.mobile-planner-title-icon,
.empty-state-icon{
  background:linear-gradient(135deg,rgba(236,95,168,.16),rgba(184,117,214,.12))!important;
  border-color:rgba(236,95,168,.24)!important;
  color:#ec5fa8!important;
}
.kpi.pmagalieum-kpi span{
  color:#4f4650!important;
}

/* Boutons */
.btn,
.icon-btn.plus,
.auth-submit-btn{
  background:linear-gradient(135deg,#f45d9e,#b875d6)!important;
  color:#ffffff!important;
  border:0!important;
  box-shadow:0 12px 26px rgba(236,95,168,.24)!important;
}
.btn.secondary,
.icon-btn{
  background:rgba(255,255,255,.86)!important;
  color:#4f4650!important;
  border:1px solid rgba(236,95,168,.20)!important;
  box-shadow:0 8px 20px rgba(184,117,214,.10)!important;
}
.btn.red,
.btn.danger-outline{
  background:rgba(239,77,115,.08)!important;
  color:#e84b71!important;
  border:1px solid rgba(239,77,115,.42)!important;
  box-shadow:none!important;
}
.icon-badge,
.notif-dot{
  background:#ec5fa8!important;
  color:#fff!important;
}

/* Planning */
.week-picker-label,
.week-label,
.day-chip{
  background:rgba(255,255,255,.86)!important;
  border:1px solid rgba(236,95,168,.18)!important;
  color:#27313b!important;
}
.day-chip.today,
.tab.active{
  background:linear-gradient(135deg,#f45d9e,#b875d6)!important;
  color:#ffffff!important;
  outline:none!important;
  border-color:transparent!important;
}
.planner-grid{
  background:
    linear-gradient(90deg,rgba(236,95,168,.10) 1px,transparent 1px),
    linear-gradient(180deg,rgba(236,95,168,.10) 1px,transparent 1px),
    rgba(255,255,255,.72)!important;
  border:1px solid rgba(236,95,168,.14)!important;
}
.time-col{
  color:#6f6270!important;
}
.planner-event,
.planner-event.alt{
  background:linear-gradient(180deg,#f45d9e,#b875d6)!important;
  border:2px solid rgba(255,255,255,.88)!important;
  color:#ffffff!important;
  box-shadow:0 10px 22px rgba(236,95,168,.28)!important;
}
.planner-event-duration{
  background:rgba(255,255,255,.22)!important;
  border-color:rgba(255,255,255,.34)!important;
}

/* Navigation basse */
.tabs-inner{
  background:rgba(255,255,255,.90)!important;
  border:1px solid rgba(236,95,168,.18)!important;
  box-shadow:0 -10px 28px rgba(184,117,214,.13)!important;
}
.tab{
  color:#897586!important;
}

/* Formulaires / modales */
.field label,
.auth-field-label,
.auth-reset-field label{
  color:#473a47!important;
}
.field input,
.field select,
.field textarea,
.auth-reset-field input{
  background:rgba(255,255,255,.92)!important;
  color:#27313b!important;
  border:1px solid rgba(236,95,168,.22)!important;
}
.field input:focus,
.field select:focus,
.field textarea:focus,
.auth-reset-field input:focus{
  border-color:rgba(236,95,168,.65)!important;
  box-shadow:0 0 0 3px rgba(236,95,168,.12)!important;
}

/* Page connexion Magalie */
.auth{
  background:
    radial-gradient(circle at 8% 0%,rgba(236,95,168,.16),transparent 32%),
    linear-gradient(180deg,#fff8fd,#fff2fa)!important;
}
.auth-poster{
  background:#fff8fd!important;
  box-shadow:0 0 70px rgba(184,117,214,.22)!important;
}
.auth-form-card{
  background:rgba(255,255,255,.55)!important;
  border:1px solid rgba(236,95,168,.16)!important;
  border-radius:24px!important;
  padding:14px!important;
  box-shadow:0 16px 38px rgba(184,117,214,.14)!important;
  backdrop-filter:blur(12px)!important;
}
.auth-form-card .auth-real-input{
  background:rgba(255,255,255,.92)!important;
  border:1px solid rgba(236,95,168,.28)!important;
  color:#27313b!important;
  -webkit-text-fill-color:#27313b!important;
  box-shadow:0 8px 18px rgba(184,117,214,.08)!important;
}
.auth-form-card .auth-real-input::placeholder{
  color:rgba(78,64,78,.42)!important;
}
.auth-form-card .auth-real-input:focus{
  border-color:rgba(236,95,168,.68)!important;
  box-shadow:0 0 0 3px rgba(236,95,168,.12),0 8px 18px rgba(184,117,214,.08)!important;
}
.auth-field-icon,
.auth-eye-btn,
.auth-forgot-btn{
  color:#ec5fa8!important;
}
.auth-remember{
  color:#473a47!important;
}
.auth-contact-btn{
  color:#b14f91!important;
}

/* Modal édition cours : petits boutons thème Magalie */
.edit-course-actions .edit-save-btn{
  background:linear-gradient(135deg,#f45d9e,#b875d6)!important;
  color:#fff!important;
}
.edit-course-actions .edit-delete-btn{
  background:rgba(239,77,115,.08)!important;
  color:#e84b71!important;
  border:1px solid rgba(239,77,115,.45)!important;
}
.edit-course-actions .edit-cancel-btn{
  background:rgba(255,255,255,.92)!important;
  color:#5a4c59!important;
  border:1px solid rgba(236,95,168,.20)!important;
}

`;

export default function App() {
  const [role, setRole] = useState<Role>(DESIGN_PREVIEW_CONNECTED ? "coach" : "coach");
  const [logged, setLogged] = useState(DESIGN_PREVIEW_CONNECTED);
  const [authChecked, setAuthChecked] = useState(DESIGN_PREVIEW_CONNECTED);
  const [profile, setProfile] = useState<Profile | null>(DESIGN_PREVIEW_CONNECTED ? PREVIEW_PROFILE : null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("cr_remember_me") === "true");
  const [authMode, setAuthMode] = useState<"login" | "set-password">("login");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [weekStart, setWeekStart] = useState(getMondayISO(todayISO()));
  const [showDemandesArchives, setShowDemandesArchives] = useState(false);
  const [tab, setTab] = useState<"planning" | "reservations" | "sportifs" | "profil" | "notifications" | "demandes">("planning");

  const [sportifs, setSportifs] = useState<Sportif[]>(DESIGN_PREVIEW_CONNECTED ? PREVIEW_SPORTIFS : []);
  const [cours, setCours] = useState<Cours[]>(DESIGN_PREVIEW_CONNECTED ? PREVIEW_COURS : []);
  const [reservations, setReservations] = useState<Reservation[]>(DESIGN_PREVIEW_CONNECTED ? PREVIEW_RESERVATIONS : []);
  const [demandesCreneaux, setDemandesCreneaux] = useState<DemandeCreneau[]>(DESIGN_PREVIEW_CONNECTED ? PREVIEW_DEMANDES : []);
  const [notifications, setNotifications] = useState<NotificationCoach[]>(DESIGN_PREVIEW_CONNECTED ? PREVIEW_NOTIFICATIONS : []);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const [showSportifModal, setShowSportifModal] = useState(false);
  const [newSportif, setNewSportif] = useState({ prenom: "", nom: "", email: "", telephone: "", niveau: "", notes: "" });
  const [editingSportif, setEditingSportif] = useState<Sportif | null>(null);
  const [editSportifForm, setEditSportifForm] = useState({ prenom: "", nom: "", email: "", telephone: "", niveau: "", notes: "" });

  const [showDemandeModal, setShowDemandeModal] = useState(false);
  const [newDemande, setNewDemande] = useState({ jour_souhaite: "Lundi", message: "" });
  const [demandePourCours, setDemandePourCours] = useState<DemandeCreneau | null>(null);
  const [coursDemandeForm, setCoursDemandeForm] = useState({
    titre: "Coaching",
    jour_semaine: "Lundi",
    date_cours: todayISO(),
    heure_debut: "18:00",
    heure_fin: "19:00",
    lieu: "",
    tarif: "15",
    capacite_max: "1",
  });

  const [showCoursModal, setShowCoursModal] = useState(false);
  const [newCours, setNewCours] = useState(resetCoursForm());

  const [selectedCours, setSelectedCours] = useState<Cours | null>(null);
  const [editingCours, setEditingCours] = useState<Cours | null>(null);
  const [editCoursForm, setEditCoursForm] = useState({
    titre: "",
    jour_semaine: "Lundi",
    date_cours: todayISO(),
    heure_debut: "18:00",
    heure_fin: "19:00",
    lieu: "",
    tarif: "15",
    capacite_max: "8",
  });

  function notify(type: "ok" | "err", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4200);
  }

  async function refreshAll(activeProfile: Profile | null = profile) {
    if (DESIGN_PREVIEW_CONNECTED) {
      notify("ok", "Mode aperçu : données de test rechargées.");
      setSportifs(PREVIEW_SPORTIFS);
      setCours(PREVIEW_COURS);
      setReservations(PREVIEW_RESERVATIONS);
      setDemandesCreneaux(PREVIEW_DEMANDES);
      setNotifications(PREVIEW_NOTIFICATIONS);
      return;
    }

    if (!supabase) {
      notify("err", "Connexion aux données indisponible.");
      return;
    }

    if (!activeProfile) {
      setSportifs([]);
      setCours([]);
      setReservations([]);
      setDemandesCreneaux([]);
      setNotifications([]);
      return;
    }

    setLoading(true);

    const sportifsQuery = supabase
      .from("sportifs")
      .select("*")
      .eq("organisation_id", ORGANISATION_ID)
      .order("prenom", { ascending: true });

    const reservationsQuery = supabase
      .from("reservations")
      .select("*")
      .eq("organisation_id", ORGANISATION_ID);

    const demandesQuery = supabase
      .from("demandes_creneaux")
      .select("*")
      .eq("organisation_id", ORGANISATION_ID)
      .order("created_at", { ascending: false });

    const notificationsQuery =
      activeProfile.role === "coach"
        ? supabase
            .from("notifications")
            .select("*")
            .eq("organisation_id", ORGANISATION_ID)
            .order("created_at", { ascending: false })
        : null;

    const [sportifsRes, coursRes, reservationsRes, demandesRes, notificationsRes] = await Promise.all([
      sportifsQuery,
      supabase.from("cours").select("*").eq("organisation_id", ORGANISATION_ID).order("date_cours", { ascending: true }),
      reservationsQuery,
      demandesQuery,
      notificationsQuery ?? Promise.resolve({ data: [], error: null }),
    ]);
    setLoading(false);

    if (sportifsRes.error) notify("err", `Lecture sportifs : ${sportifsRes.error.message}`);
    if (coursRes.error) notify("err", `Lecture cours : ${coursRes.error.message}`);
    if (reservationsRes.error) notify("err", `Lecture réservations : ${reservationsRes.error.message}`);
    if (demandesRes.error) notify("err", `Lecture demandes : ${demandesRes.error.message}`);
    if (notificationsRes.error) notify("err", `Lecture notifications : ${notificationsRes.error.message}`);

    setSportifs((sportifsRes.data || []).map(mapSportif));
    setCours((coursRes.data || []).map(mapCours));
    setReservations((reservationsRes.data || []).map(mapReservation));
    setDemandesCreneaux((demandesRes.data || []).map(mapDemandeCreneau));
    setNotifications((notificationsRes.data || []).map(mapNotification));
  }

  useEffect(() => {
    async function initAuth() {
      if (DESIGN_PREVIEW_CONNECTED) {
        setAuthChecked(true);
        setLogged(true);
        setProfile(PREVIEW_PROFILE);
        setSportifs(PREVIEW_SPORTIFS);
        setCours(PREVIEW_COURS);
        setReservations(PREVIEW_RESERVATIONS);
        setDemandesCreneaux(PREVIEW_DEMANDES);
        setNotifications(PREVIEW_NOTIFICATIONS);
        return;
      }

      if (!supabase) {
        setAuthChecked(true);
        return;
      }

      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const query = new URLSearchParams(url.search);
      const authType = hash.get("type") || query.get("type");
      const hasCode = Boolean(query.get("code"));
      const hasAuthToken = Boolean(hash.get("access_token") || query.get("access_token") || hasCode);

      if (hasCode) {
        await supabase.auth.exchangeCodeForSession(window.location.href);
      }

      const { data } = await supabase.auth.getSession();

      if (hasAuthToken || authType === "invite" || authType === "recovery") {
        setAuthMode("set-password");
        setRole("sportif");
        setLogged(false);
        setProfile(null);
        setAuthChecked(true);
        return;
      }

      if (data.session?.user && localStorage.getItem("cr_remember_me") === "true") {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", data.session.user.id)
          .eq("organisation_id", ORGANISATION_ID)
          .maybeSingle();

        if (profileData) {
          const activeProfile = {
            id: String(profileData.id),
            user_id: String(profileData.user_id),
            organisation_id: String(profileData.organisation_id || ORGANISATION_ID),
            role: String(profileData.role || "sportif") as Role,
            nom: profileData.nom ?? null,
            prenom: profileData.prenom ?? null,
          };

          setProfile(activeProfile);
          setRole(activeProfile.role);
          setLogged(true);
          setAuthChecked(true);
          await refreshAll(activeProfile);
          return;
        }
      }

      if (data.session?.user) {
        await supabase.auth.signOut();
      }

      setAuthMode("login");
      setLogged(false);
      setProfile(null);
      setAuthChecked(true);
      return;
    }

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mapSportif(row: any): Sportif {
    return {
      id: String(row.id),
      organisation_id: String(row.organisation_id || ORGANISATION_ID),
      profile_id: row.profile_id ? String(row.profile_id) : null,
      nom: String(row.nom || "").trim(),
      prenom: String(row.prenom || row.nom_complet || "").trim(),
      email: row.email ?? row.email_contact ?? null,
      telephone: row.telephone ?? row.phone ?? null,
      niveau: row.niveau ?? null,
      notes: row.notes ?? null,
    };
  }

  function mapCours(row: any): Cours {
    const date = String(row.date_cours || row.date || "").slice(0, 10);
    const heure = String(row.heure_debut || row.heure || row.start_time || "10:00").slice(0, 8);
    const heureFin = row.heure_fin ? String(row.heure_fin).slice(0, 8) : null;
    return {
      id: String(row.id),
      organisation_id: String(row.organisation_id || ORGANISATION_ID),
      titre: String(row.titre || row.type || row.nom || "Cours"),
      jour_semaine: getJourFromDate(date) || String(row.jour_semaine || row.jour || "Lundi"),
      date_cours: date || todayISO(),
      heure_debut: heure,
      heure_fin: heureFin,
      lieu: String(row.lieu || row.location || ""),
      tarif: Number(row.tarif ?? row.prix ?? 0),
      capacite_max: Number(row.capacite_max ?? row.places ?? row.capacite ?? 8),
      week_offset: Number(row.week_offset ?? 0),
    };
  }

  function mapReservation(row: any): Reservation {
    return {
      id: String(row.id),
      organisation_id: String(row.organisation_id || ORGANISATION_ID),
      cours_id: String(row.cours_id),
      sportif_id: String(row.sportif_id),
      statut: row.statut ?? "active",
    };
  }

  function mapDemandeCreneau(row: any): DemandeCreneau {
    return {
      id: String(row.id),
      organisation_id: String(row.organisation_id || ORGANISATION_ID),
      sportif_id: String(row.sportif_id || ""),
      jour_souhaite: String(row.jour_souhaite || ""),
      message: String(row.message || ""),
      statut: String(row.statut || "en_attente"),
      created_at: String(row.created_at || ""),
    };
  }

  function mapNotification(row: any): NotificationCoach {
    return {
      id: String(row.id),
      organisation_id: String(row.organisation_id || ORGANISATION_ID),
      coach_id: row.coach_id ? String(row.coach_id) : null,
      sportif_id: row.sportif_id ? String(row.sportif_id) : null,
      type: String(row.type || "info"),
      titre: String(row.titre || "Notification"),
      message: String(row.message || ""),
      lu: Boolean(row.lu),
      created_at: String(row.created_at || ""),
    };
  }

  function activeReservationsForCours(coursId: string) {
    return reservations.filter(
      (r) =>
        String(r.cours_id) === String(coursId) &&
        !["annulee", "annulée", "deleted", "supprimee"].includes(normalizeStatut(r.statut))
    );
  }

  function estInscrit(coursId: string, sportifId: string) {
    return activeReservationsForCours(coursId).some(
      (r) => String(r.sportif_id) === String(sportifId)
    );
  }

  function sportifsInscrits(coursId: string) {
    const ids = new Set(activeReservationsForCours(coursId).map((r) => r.sportif_id));
    return sportifs.filter((s) => ids.has(s.id));
  }

  function nbReservationsSportif(sportifId: string) {
    return reservations.filter(
      (r) =>
        String(r.sportif_id) === String(sportifId) &&
        !["annulee", "annulée", "deleted", "supprimee"].includes(normalizeStatut(r.statut))
    ).length;
  }

  function reservationsVisibles() {
    const actives = reservations.filter(
      (r) => !["annulee", "annulée", "deleted", "supprimee"].includes(normalizeStatut(r.statut))
    );

    if (role === "coach") return actives;
    if (!sportifConnecte) return [];

    return actives.filter((r) => String(r.sportif_id) === String(sportifConnecte.id));
  }

  function demandesVisibles() {
    const base = role === "coach" ? demandesCreneaux : sportifConnecte ? demandesCreneaux.filter((d) => String(d.sportif_id) === String(sportifConnecte.id)) : [];
    return base.filter((d) => showDemandesArchives ? isDemandeArchivee(d) : !isDemandeArchivee(d));
  }

  function demandesEnAttenteCoach() {
    return demandesCreneaux.filter((d) => normalizeStatut(d.statut) === "en_attente").length;
  }

  function libelleStatutDemande(statut: string) {
    const value = normalizeStatut(statut);
    if (value === "acceptee" || value === "acceptée") return "Acceptée";
    if (value === "refusee" || value === "refusée") return "Refusée";
    return "En attente";
  }

  function peutVoirInscrits(coursId: string) {
    if (role === "coach") return true;
    if (!sportifConnecte) return false;

    return activeReservationsForCours(coursId).some(
      (r) => String(r.sportif_id) === String(sportifConnecte.id)
    );
  }


  async function creerNotificationCoach(params: {
    sportifId?: string | null;
    type: string;
    titre: string;
    message: string;
  }) {
    if (!supabase) return;

    const { error } = await supabase.from("notifications").insert({
      organisation_id: ORGANISATION_ID,
      coach_id: null,
      sportif_id: params.sportifId || null,
      type: params.type,
      titre: params.titre,
      message: params.message,
      lu: false,
    });

    if (error) {
      console.error("Création notification coach :", error.message);
    }
  }

  async function marquerNotificationLue(notificationId: string) {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");

    const { error } = await supabase
      .from("notifications")
      .update({ lu: true })
      .eq("organisation_id", ORGANISATION_ID)
      .eq("id", notificationId);

    if (error) return notify("err", `Notification : ${error.message}`);

    setNotifications((items) =>
      items.map((n) => (n.id === notificationId ? { ...n, lu: true } : n))
    );
  }

  async function marquerToutesNotificationsLues() {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");

    const ids = notifications.filter((n) => !n.lu).map((n) => n.id);
    if (!ids.length) return notify("ok", "Aucune notification non lue.");

    const { error } = await supabase
      .from("notifications")
      .update({ lu: true })
      .eq("organisation_id", ORGANISATION_ID)
      .in("id", ids);

    if (error) return notify("err", `Notifications : ${error.message}`);

    setNotifications((items) => items.map((n) => ({ ...n, lu: true })));
    notify("ok", "Notifications marquées comme lues.");
  }


  async function effacerToutesNotifications() {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");

    if (!notifications.length) return notify("ok", "Aucune notification à effacer.");
    if (!confirm("Effacer toutes les notifications ?")) return;

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("organisation_id", ORGANISATION_ID);

    if (error) return notify("err", `Suppression notifications : ${error.message}`);

    setNotifications([]);
    notify("ok", "Notifications effacées.");
  }

  async function envoyerDemandeCreneau() {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");
    if (!sportifConnecte) return notify("err", "Profil sportif introuvable.");

    const jour = newDemande.jour_souhaite.trim();
    const message = newDemande.message.trim();

    if (!jour) return notify("err", "Choisis un jour souhaité.");
    if (!message) return notify("err", "Ajoute un court message pour le coach.");

    setLoading(true);
    const { error } = await supabase.from("demandes_creneaux").insert({
      organisation_id: ORGANISATION_ID,
      sportif_id: sportifConnecte.id,
      jour_souhaite: jour,
      message,
      statut: "en_attente",
    });
    setLoading(false);

    if (error) return notify("err", `Demande de créneau : ${error.message}`);

    await creerNotificationCoach({
      sportifId: sportifConnecte.id,
      type: "demande_creneau",
      titre: "Nouvelle demande de créneau",
      message: `${sportifConnecte.prenom} ${sportifConnecte.nom} souhaite un créneau le ${jour}. Message : ${message}`,
    });

    setNewDemande({ jour_souhaite: "Lundi", message: "" });
    setShowDemandeModal(false);
    notify("ok", "Demande envoyée au coach.");
    await refreshAll();
  }

  function ouvrirCreationCoursDepuisDemande(demande: DemandeCreneau) {
    const sportif = sportifs.find((s) => s.id === demande.sportif_id);
    const jour = demande.jour_souhaite || "Lundi";

    setDemandePourCours(demande);
    setCoursDemandeForm({
      titre: sportif ? `Coaching ${sportif.prenom}` : "Coaching",
      jour_semaine: jours.includes(jour) ? jour : "Lundi",
      date_cours: todayISO(),
      heure_debut: "18:00",
      heure_fin: "19:00",
      lieu: "",
      tarif: "15",
      capacite_max: "1",
    });
  }

  async function creerCoursDepuisDemande() {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");
    if (!demandePourCours) return notify("err", "Demande introuvable.");
    if (!coursDemandeForm.titre.trim()) return notify("err", "Nom du cours obligatoire.");
    if (!coursDemandeForm.date_cours) return notify("err", "Date obligatoire.");
    if (!coursDemandeForm.heure_debut) return notify("err", "Heure de début obligatoire.");
    if (!coursDemandeForm.heure_fin) return notify("err", "Heure de fin obligatoire.");

    const sportif = sportifs.find((s) => s.id === demandePourCours.sportif_id);

    setLoading(true);
    const coursInsert = await supabase.from("cours").insert({
      organisation_id: ORGANISATION_ID,
      titre: coursDemandeForm.titre.trim(),
      jour_semaine: coursDemandeForm.jour_semaine,
      date_cours: coursDemandeForm.date_cours,
      heure_debut: coursDemandeForm.heure_debut,
      heure_fin: coursDemandeForm.heure_fin,
      lieu: coursDemandeForm.lieu.trim(),
      tarif: Number(coursDemandeForm.tarif || 0),
      capacite_max: Number(coursDemandeForm.capacite_max || 1),
      week_offset: 0,
    });

    if (coursInsert.error) {
      setLoading(false);
      return notify("err", `Création cours : ${coursInsert.error.message}`);
    }

    const demandeUpdate = await supabase
      .from("demandes_creneaux")
      .update({ statut: "acceptee" })
      .eq("organisation_id", ORGANISATION_ID)
      .eq("id", demandePourCours.id);

    setLoading(false);

    if (demandeUpdate.error) return notify("err", `Mise à jour demande : ${demandeUpdate.error.message}`);

    await creerNotificationCoach({
      sportifId: demandePourCours.sportif_id,
      type: "demande_acceptee_cours",
      titre: "Cours créé depuis une demande",
      message: `${sportif ? `${sportif.prenom} ${sportif.nom}` : "Un sportif"} : cours ${coursDemandeForm.titre.trim()} créé le ${coursDemandeForm.date_cours} de ${coursDemandeForm.heure_debut} à ${coursDemandeForm.heure_fin}.`,
    });

    setDemandePourCours(null);
    notify("ok", "Cours créé et demande acceptée.");
    await refreshAll();
  }

  async function changerStatutDemande(demandeId: string, statut: "refusee") {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");

    const { error } = await supabase
      .from("demandes_creneaux")
      .update({ statut })
      .eq("organisation_id", ORGANISATION_ID)
      .eq("id", demandeId);

    if (error) return notify("err", `Mise à jour demande : ${error.message}`);

    notify("ok", "Demande refusée.");
    await refreshAll();
  }

  async function ajouterSportif() {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");

    const prenom = newSportif.prenom.trim();
    const nom = newSportif.nom.trim();
    const email = newSportif.email.trim().toLowerCase();

    if (!prenom || !nom) return notify("err", "Prénom et nom obligatoires.");
    if (!email) return notify("err", "Email obligatoire pour créer l'accès sportif.");

    setLoading(true);

    const { data, error } = await supabase.functions.invoke("creer-acces-sportif", {
      body: {
        organisation_id: ORGANISATION_ID,
        prenom,
        nom,
        email,
        telephone: newSportif.telephone.trim() || null,
        niveau: newSportif.niveau.trim() || null,
        notes: newSportif.notes.trim() || null,
      },
    });

    setLoading(false);

    if (error) {
      return notify(
        "err",
        `Création accès sportif : ${error.message || "fonction Supabase indisponible"}`
      );
    }

    if (data?.error) {
      return notify("err", `Création accès sportif : ${data.error}`);
    }

    if (!data?.ok) {
      return notify("err", "Création accès sportif : réponse Supabase invalide.");
    }

    setNewSportif({ prenom: "", nom: "", email: "", telephone: "", niveau: "", notes: "" });
    setShowSportifModal(false);
    notify("ok", "Sportif ajouté et invitation envoyée par email.");
    await refreshAll();
  }

  function ouvrirModificationSportif(s: Sportif) {
    setEditingSportif(s);
    setEditSportifForm({
      prenom: s.prenom || "",
      nom: s.nom || "",
      email: s.email || "",
      telephone: s.telephone || "",
      niveau: s.niveau || "",
      notes: s.notes || "",
    });
  }

  async function modifierSportif() {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");
    if (!editingSportif) return notify("err", "Sportif introuvable.");

    const prenom = editSportifForm.prenom.trim();
    const nom = editSportifForm.nom.trim();

    if (!prenom || !nom) {
      return notify("err", "Prénom et nom obligatoires.");
    }

    setLoading(true);
    const { error } = await supabase
      .from("sportifs")
      .update({
        prenom,
        nom,
        email: editSportifForm.email.trim() || null,
        telephone: editSportifForm.telephone.trim() || null,
        niveau: editSportifForm.niveau.trim() || null,
        notes: editSportifForm.notes.trim() || null,
      })
      .eq("organisation_id", ORGANISATION_ID)
      .eq("id", editingSportif.id);
    setLoading(false);

    if (error) return notify("err", `Modification sportif : ${error.message}`);

    notify("ok", "Sportif modifié.");
    setEditingSportif(null);
    await refreshAll();
  }

  async function supprimerSportif(sportifId: string) {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");
    if (!confirm("Supprimer ce sportif et ses réservations ?")) return;
    setLoading(true);
    const reservationsDelete = await supabase.from("reservations").delete().eq("organisation_id", ORGANISATION_ID).eq("sportif_id", sportifId);
    const sportifDelete = await supabase.from("sportifs").delete().eq("organisation_id", ORGANISATION_ID).eq("id", sportifId);
    setLoading(false);
    if (reservationsDelete.error) return notify("err", `Suppression réservations : ${reservationsDelete.error.message}`);
    if (sportifDelete.error) return notify("err", `Suppression sportif : ${sportifDelete.error.message}`);
    notify("ok", "Sportif supprimé.");
    await refreshAll();
  }

  async function creerCours() {
    const titre = newCours.titre.trim();
    const recurrence = newCours.recurrence;
    const dates = buildOccurrencesUntil(newCours.date_cours, recurrence, newCours.date_fin_recurrence);
    const occurrences = dates.length;

    if (!titre) return notify("err", "Nom du cours obligatoire.");
    if (!newCours.date_cours) return notify("err", "Date obligatoire.");
    if (!newCours.heure_debut) return notify("err", "Heure de début obligatoire.");
    if (!newCours.heure_fin) return notify("err", "Heure de fin obligatoire.");
    if (recurrence !== "unique" && newCours.date_fin_recurrence < newCours.date_cours) return notify("err", "La date de fin doit être après le pmagalieer cours.");
    if (recurrence !== "unique" && occurrences < 2) return notify("err", "La date de fin ne crée qu'un seul cours. Choisis une date plus éloignée.");

    const coursAInserer = dates.map((date_cours, index) => ({
      organisation_id: ORGANISATION_ID,
      titre,
      jour_semaine: getJourFromDate(date_cours) || newCours.jour_semaine,
      date_cours,
      heure_debut: newCours.heure_debut,
      heure_fin: newCours.heure_fin,
      lieu: newCours.lieu.trim(),
      tarif: Number(newCours.tarif || 0),
      capacite_max: Number(newCours.capacite_max || 8),
      week_offset: index,
    }));

    if (DESIGN_PREVIEW_CONNECTED) {
      const previewCours = coursAInserer.map((c, index) => ({
        id: `preview-cours-${Date.now()}-${index}`,
        ...c,
      }));
      setCours((items) => [...items, ...previewCours]);
      setNewCours(resetCoursForm());
      setShowCoursModal(false);
      notify("ok", occurrences === 1 ? "Cours créé en aperçu." : `${occurrences} cours créés en aperçu.`);
      return;
    }

    if (!supabase) return notify("err", "Connexion aux données indisponible.");

    setLoading(true);
    const { error } = await supabase.from("cours").insert(coursAInserer);
    setLoading(false);

    if (error) return notify("err", `Création cours : ${error.message}`);

    setNewCours(resetCoursForm());
    setShowCoursModal(false);
    notify("ok", occurrences === 1 ? "Cours créé." : `${occurrences} cours créés (${recurrenceLabel(recurrence)}).`);
    await refreshAll();
  }

  function ouvrirModificationCours(c: Cours) {
    setEditingCours(c);
    setEditCoursForm({
      titre: c.titre || "",
      jour_semaine: c.jour_semaine || "Lundi",
      date_cours: c.date_cours || todayISO(),
      heure_debut: String(c.heure_debut || "18:00").slice(0, 5),
      heure_fin: String(c.heure_fin || "19:00").slice(0, 5),
      lieu: c.lieu || "",
      tarif: String(c.tarif ?? 0),
      capacite_max: String(c.capacite_max ?? 8),
    });
  }

  async function modifierCours() {
    if (!editingCours) return notify("err", "Cours introuvable.");
    if (!editCoursForm.titre.trim()) return notify("err", "Nom du cours obligatoire.");

    const coursModifie: Cours = {
      ...editingCours,
      titre: editCoursForm.titre.trim(),
      jour_semaine: getJourFromDate(editCoursForm.date_cours) || editCoursForm.jour_semaine,
      date_cours: editCoursForm.date_cours,
      heure_debut: editCoursForm.heure_debut,
      heure_fin: editCoursForm.heure_fin,
      lieu: editCoursForm.lieu.trim(),
      tarif: Number(editCoursForm.tarif || 0),
      capacite_max: Number(editCoursForm.capacite_max || 8),
    };

    if (DESIGN_PREVIEW_CONNECTED) {
      setCours((items) => items.map((c) => (c.id === editingCours.id ? coursModifie : c)));
      setSelectedCours(null);
      setEditingCours(null);
      setWeekStart(getMondayISO(coursModifie.date_cours));
      notify("ok", "Cours modifié en aperçu.");
      return;
    }

    if (!supabase) return notify("err", "Connexion aux données indisponible.");

    setLoading(true);
    const { error } = await supabase
      .from("cours")
      .update({
        titre: coursModifie.titre,
        jour_semaine: coursModifie.jour_semaine,
        date_cours: coursModifie.date_cours,
        heure_debut: coursModifie.heure_debut,
        heure_fin: coursModifie.heure_fin,
        lieu: coursModifie.lieu,
        tarif: coursModifie.tarif,
        capacite_max: coursModifie.capacite_max,
      })
      .eq("organisation_id", ORGANISATION_ID)
      .eq("id", editingCours.id);
    setLoading(false);

    if (error) return notify("err", `Modification cours : ${error.message}`);

    // Mise à jour immédiate de l'état local : le planning/agendas se recalculent sans attendre le rechargement Supabase.
    setCours((items) => items.map((c) => (c.id === editingCours.id ? coursModifie : c)));
    setSelectedCours(null);
    setEditingCours(null);
    setWeekStart(getMondayISO(coursModifie.date_cours));
    notify("ok", "Cours modifié.");
    await refreshAll();
  }

  function sameCoursSerie(base: Cours, candidate: Cours) {
    return (
      cleanText(candidate.titre) === cleanText(base.titre) &&
      cleanText(candidate.jour_semaine) === cleanText(base.jour_semaine) &&
      fmtTime(candidate.heure_debut) === fmtTime(base.heure_debut) &&
      fmtTime(candidate.heure_fin) === fmtTime(base.heure_fin) &&
      cleanText(candidate.lieu) === cleanText(base.lieu) &&
      Number(candidate.tarif || 0) === Number(base.tarif || 0) &&
      Number(candidate.capacite_max || 0) === Number(base.capacite_max || 0)
    );
  }

  function coursSerieIds(base: Cours) {
    return cours
      .filter((c) => sameCoursSerie(base, c))
      .map((c) => c.id);
  }

  async function supprimerCours(coursId: string) {
    const coursBase = cours.find((c) => String(c.id) === String(coursId));
    if (!coursBase) return notify("err", "Cours introuvable.");

    const serieIds = coursSerieIds(coursBase);
    const supprimerSerie =
      serieIds.length > 1 &&
      confirm(`Ce cours semble faire partie d'une récurrence (${serieIds.length} cours).\n\nOK = supprimer toute la récurrence\nAnnuler = supprimer seulement ce cours`);
    const idsASupprimer = supprimerSerie ? serieIds : [coursId];

    if (!confirm(supprimerSerie ? "Confirmer la suppression de toute la récurrence et des réservations associées ?" : "Supprimer uniquement ce cours et ses réservations ?")) return;

    if (DESIGN_PREVIEW_CONNECTED) {
      setReservations((items) => items.filter((r) => !idsASupprimer.includes(r.cours_id)));
      setCours((items) => items.filter((c) => !idsASupprimer.includes(c.id)));
      setSelectedCours(null);
      setEditingCours(null);
      notify("ok", supprimerSerie ? "Récurrence supprimée en aperçu." : "Cours supprimé en aperçu.");
      return;
    }

    if (!supabase) return notify("err", "Connexion aux données indisponible.");
    setLoading(true);
    const reservationsDelete = await supabase.from("reservations").delete().eq("organisation_id", ORGANISATION_ID).in("cours_id", idsASupprimer);
    const coursDelete = await supabase.from("cours").delete().eq("organisation_id", ORGANISATION_ID).in("id", idsASupprimer);
    setLoading(false);
    if (reservationsDelete.error) return notify("err", `Suppression réservations : ${reservationsDelete.error.message}`);
    if (coursDelete.error) return notify("err", `Suppression cours : ${coursDelete.error.message}`);
    setSelectedCours(null);
    setEditingCours(null);
    notify("ok", supprimerSerie ? "Récurrence supprimée." : "Cours supprimé.");
    await refreshAll();
  }

  async function inscrireSportif(coursId: string, sportifId: string) {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");
    const c = cours.find((x) => x.id === coursId);
    if (!c) return notify("err", "Cours introuvable.");
    const dejaInscrit = estInscrit(coursId, sportifId);
    if (dejaInscrit) return notify("err", "Tu es déjà inscrit à ce cours.");
    if (activeReservationsForCours(coursId).length >= c.capacite_max) return notify("err", "Cours complet.");
    setLoading(true);
    const { error } = await supabase.from("reservations").insert({ organisation_id: ORGANISATION_ID, cours_id: coursId, sportif_id: sportifId, statut: "active" });
    setLoading(false);
    if (error) return notify("err", `Inscription : ${error.message}`);

    const sportif = sportifs.find((s) => s.id === sportifId);
    if (role === "sportif") {
      await creerNotificationCoach({
        sportifId,
        type: "reservation",
        titre: "Nouvelle réservation",
        message: `${sportif ? `${sportif.prenom} ${sportif.nom}` : "Un sportif"} s'est inscrit au cours ${c.titre}.`,
      });
    }

    notify("ok", "Réservation confirmée.");
    await refreshAll();
  }

  async function retirerSportif(coursId: string, sportifId: string) {
    if (!supabase) return notify("err", "Connexion aux données indisponible.");
    setLoading(true);
    const { error } = await supabase.from("reservations").delete().eq("organisation_id", ORGANISATION_ID).eq("cours_id", coursId).eq("sportif_id", sportifId);
    setLoading(false);
    if (error) return notify("err", `Retrait : ${error.message}`);

    const sportif = sportifs.find((s) => s.id === sportifId);
    const c = cours.find((x) => x.id === coursId);
    if (role === "sportif") {
      await creerNotificationCoach({
        sportifId,
        type: "desinscription",
        titre: "Désinscription",
        message: `${sportif ? `${sportif.prenom} ${sportif.nom}` : "Un sportif"} s'est désinscrit${c ? ` du cours ${c.titre}` : ""}.`,
      });
    }

    notify("ok", "Réservation supprimée.");
    await refreshAll();
  }

  async function chargerProfilConnecte(userId: string, userEmail?: string | null) {
    if (!supabase) return;

    const email = String(userEmail || "").trim().toLowerCase();

    // Sécurité temporaire V1 : le compte Magalie est forcé en coach
    // pour éviter les blocages de liaison profiles pendant la démo.
    if (email === "magalie@test.fr") {
      const connectedProfile: Profile = {
        id: "coach-magalie",
        user_id: userId,
        organisation_id: ORGANISATION_ID,
        role: "coach",
        nom: "Magalie",
        prenom: "Magalie",
      };

      setProfile(connectedProfile);
      setRole("coach");
      setLogged(true);
      setTab("planning");
      await refreshAll(connectedProfile);
      return;
    }

    setLoading(true);

    const profileRes = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileRes.data) {
      const connectedProfile: Profile = {
        id: String(profileRes.data.id),
        user_id: String(profileRes.data.user_id || userId),
        organisation_id: String(profileRes.data.organisation_id || ORGANISATION_ID),
        role: profileRes.data.role === "coach" ? "coach" : "sportif",
        nom: profileRes.data.nom ?? null,
        prenom: profileRes.data.prenom ?? null,
      };

      setLoading(false);
      setProfile(connectedProfile);
      setRole(connectedProfile.role);
      setLogged(true);
      setTab("planning");
      await refreshAll(connectedProfile);
      return;
    }

    // Fallback sportif : si profiles est bloqué par RLS ou mal lié,
    // on retrouve le sportif par son email dans la table sportifs.
    if (email) {
      const sportifRes = await supabase
        .from("sportifs")
        .select("*")
        .eq("organisation_id", ORGANISATION_ID)
        .ilike("email", email)
        .maybeSingle();

      if (sportifRes.data) {
        const connectedProfile: Profile = {
          id: String(sportifRes.data.profile_id || sportifRes.data.id),
          user_id: userId,
          organisation_id: String(sportifRes.data.organisation_id || ORGANISATION_ID),
          role: "sportif",
          nom: sportifRes.data.nom ?? null,
          prenom: sportifRes.data.prenom ?? null,
        };

        if (role !== "sportif") {
          await supabase.auth.signOut();
          setLoading(false);
          setLogged(false);
          setProfile(null);
          notify("err", "Ce compte est un compte sportif. Sélectionne Sportif pour te connecter.");
          return;
        }

        setLoading(false);
        setProfile(connectedProfile);
        setRole("sportif");
        setLogged(true);
        setTab("planning");
        await refreshAll(connectedProfile);
        return;
      }
    }

    setLoading(false);
    setLogged(false);
    setProfile(null);
    notify("err", "Profil introuvable pour ce compte. Vérifie l'email dans Supabase.");
  }

  async function login() {
    const email = loginEmail.trim().toLowerCase();
    const password = loginPass.trim();

    if (!email || !password) {
      return notify("err", "Email et mot de passe obligatoires.");
    }

    localStorage.setItem("cr_remember_me", rememberMe ? "true" : "false");

    // DEMO MAGALIE : accès direct si Supabase est désactivé ou si VITE_MODE_DEMO=true.
    // Codes conseillés : demo@magalie.fr / 123456
    if (MODE_DEMO || !supabase) {
      const demoProfile: Profile = {
        id: "coach-magalie-demo",
        user_id: "demo-magalie",
        organisation_id: ORGANISATION_ID,
        role: "coach",
        nom: "Magalie",
        prenom: "Coach",
      };

      setProfile(demoProfile);
      setRole("coach");
      setLogged(true);
      setAuthChecked(true);
      setTab("planning");
      setSportifs(PREVIEW_SPORTIFS);
      setCours(PREVIEW_COURS);
      setReservations(PREVIEW_RESERVATIONS);
      setDemandesCreneaux(PREVIEW_DEMANDES);
      setNotifications(PREVIEW_NOTIFICATIONS);
      notify("ok", "Mode démo Magalie activé.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error || !data.user) {
      return notify("err", "Connexion refusée. Vérifie l'email et le mot de passe.");
    }

    await chargerProfilConnecte(data.user.id, data.user.email || email);
  }

  async function validerNouveauMotDePasse() {
    if (!supabase) return notify("err", "Connexion Supabase indisponible.");

    const password = newPassword.trim();
    const confirm = newPasswordConfirm.trim();

    if (!password || !confirm) return notify("err", "Saisis et confirme le nouveau mot de passe.");
    if (password.length < 6) return notify("err", "Le mot de passe doit contenir au moins 6 caractères.");
    if (password !== confirm) return notify("err", "Les deux mots de passe ne correspondent pas.");

    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const { data: updateData, error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) return notify("err", userFriendlyAuthError(error.message));

    const user = updateData.user || sessionData.session?.user;
    setNewPassword("");
    setNewPasswordConfirm("");
    setAuthMode("login");

    window.history.replaceState({}, document.title, window.location.pathname);

    if (user?.id) {
      notify("ok", "Mot de passe créé. Connexion en cours...");
      await chargerProfilConnecte(user.id, user.email || null);
      return;
    }

    notify("ok", "Mot de passe créé. Connecte-toi avec ton email.");
  }

  async function envoyerResetMotDePasse() {
    if (!supabase) return notify("err", "Connexion Supabase indisponible.");

    const email = loginEmail.trim().toLowerCase();
    if (!email) return notify("err", "Saisis d'abord ton email, puis clique sur Mot de passe oublié.");

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://app-coach-seven.vercel.app",
    });
    setLoading(false);

    if (error) return notify("err", userFriendlyAuthError(error.message));
    notify("ok", "Email envoyé. Ouvre le lien reçu pour créer un nouveau mot de passe.");
  }

  async function logout() {
    if (DESIGN_PREVIEW_CONNECTED) {
      notify("ok", "Mode aperçu : la déconnexion est désactivée pour tester les onglets.");
      return;
    }

    if (supabase) await supabase.auth.signOut();
    setLogged(false);
    setProfile(null);
    setSportifs([]);
    setCours([]);
    setReservations([]);
    setDemandesCreneaux([]);
    setNotifications([]);
    setLoginPass("");
    setTab("planning");
  }

  const totalPlaces = cours.reduce((a, c) => a + c.capacite_max, 0);
  const totalInscrits = cours.reduce((a, c) => a + activeReservationsForCours(c.id).length, 0);
  const ca = cours.reduce((a, c) => a + activeReservationsForCours(c.id).length * c.tarif, 0);
  const remplissage = totalPlaces ? Math.round((totalInscrits / totalPlaces) * 100) : 0;
  const notificationsNonLues = notifications.filter((n) => !n.lu).length;
  const demandesEnAttente = demandesEnAttenteCoach();
  const weekEnd = getWeekEndISO(weekStart);
  const coursSemaine = cours.filter((c) => isDateInWeek(c.date_cours, weekStart));

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysISO(weekStart, index);
    return {
      date,
      short: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][index],
      label: new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    };
  });
  const planningHours = [8, 10, 12, 14, 16, 18, 20, 22];
  const PLANNING_START_HOUR = 8;
  const PLANNING_END_HOUR = 22;
  const PLANNING_GRID_HEIGHT = 360;
  const PLANNING_TOP_OFFSET = 18;
  const PLANNING_HOUR_HEIGHT = 24;
  const PLANNING_EVENT_MIN_HEIGHT = 54;
  const PLANNING_EVENT_MAX_HEIGHT = 150;

  function timeToMinutes(value?: string | null) {
    const clean = String(value || "00:00").slice(0, 5);
    const [hh, mm] = clean.split(":").map((n) => Number(n));
    return (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
  }

  function getCoursDurationMinutes(c: Cours) {
    const start = timeToMinutes(c.heure_debut || "18:00");
    const end = c.heure_fin ? timeToMinutes(c.heure_fin) : start + 60;
    return Math.max(30, end - start);
  }

  function formatCoursDuration(c: Cours) {
    const minutes = getCoursDurationMinutes(c);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h}h${String(m).padStart(2, "0")}`;
    if (h) return `${h}h`;
    return `${m}min`;
  }

  function getCoursGridStyle(c: Cours) {
    const dayIndex = Math.max(0, weekDays.findIndex((d) => d.date === c.date_cours));
    const startMinutes = timeToMinutes(c.heure_debut || "18:00");
    const startHourDecimal = startMinutes / 60;
    const top =
      Math.max(0, Math.min(PLANNING_END_HOUR - PLANNING_START_HOUR, startHourDecimal - PLANNING_START_HOUR)) *
        PLANNING_HOUR_HEIGHT +
      PLANNING_TOP_OFFSET;

    const realHeight = (getCoursDurationMinutes(c) / 60) * PLANNING_HOUR_HEIGHT;
    const availableHeight = Math.max(PLANNING_EVENT_MIN_HEIGHT, PLANNING_GRID_HEIGHT - top - 10);
    const height = Math.min(Math.max(realHeight, PLANNING_EVENT_MIN_HEIGHT), PLANNING_EVENT_MAX_HEIGHT, availableHeight);

    return {
      left: `${13 + dayIndex * 12.4}%`,
      top: `${top}px`,
      height: `${height}px`,
    };
  }


  const sportifConnecte = useMemo(() => {
    if (role !== "sportif" || !profile) return null;

    const byProfileId = sportifs.find((s) => String(s.profile_id || "") === String(profile.id));
    if (byProfileId) return byProfileId;

    const profilePrenom = String(profile.prenom || "").trim().toLowerCase();
    const profileNom = String(profile.nom || "").trim().toLowerCase();

    return (
      sportifs.find(
        (s) =>
          String(s.prenom || "").trim().toLowerCase() === profilePrenom &&
          String(s.nom || "").trim().toLowerCase() === profileNom
      ) || null
    );
  }, [profile, role, sportifs]);

  if (!authChecked) {
    return (
      <>
        <style>{css}</style>
        <div className="auth">
          <div className="auth-shell">
            <div className="auth-card auth-loading">Chargement de l'application...</div>
          </div>
        </div>
      </>
    );
  }

  if (authMode === "set-password") {
    return (
      <>
        <style>{css}</style>
        <div className="auth">
          <div className="auth-reset-card">
            <h1>Créer votre mot de passe</h1>
            <p>Choisissez un mot de passe pour activer votre accès Coach Magalie — Pilates & Bien-être.</p>
            <div className="auth-reset-field">
              <label>Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="auth-reset-field">
              <label>Confirmer le mot de passe</label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                onKeyDown={(e) => { if (e.key === "Enter") validerNouveauMotDePasse(); }}
              />
            </div>
            <div className="auth-reset-actions">
              <button type="button" className="btn" onClick={validerNouveauMotDePasse} disabled={loading}>
                Activer mon compte
              </button>
            </div>
            <div className="auth-reset-note">Minimum 6 caractères. Après validation, l'accès sportif s'ouvrira automatiquement.</div>
            {toast && <div className={`auth-status-floating ${toast.type}`}>{toast.message}</div>}
          </div>
        </div>
      </>
    );
  }

  if (!logged) {
    return (
      <>
        <style>{css}</style>
        <div className="auth">
          <div className="auth-poster">
            <img
              className="auth-poster-img"
              src={loginMagalieClean}
              alt="Coach Magalie"
            />

            <div className="auth-form-card">
              <label className="auth-field-label">Email</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">✉️</span>
                <input
                  className="auth-real-input email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="Votre email"
                />
              </div>

              <label className="auth-field-label">Mot de passe</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">🔒</span>
                <input
                  className="auth-real-input password"
                  type={showPassword ? "text" : "password"}
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  onKeyDown={(e) => { if (e.key === "Enter") login(); }}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword((v) => !v);
                  }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>

              <div className="auth-options-row">
                <label className="auth-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      setRememberMe(e.target.checked);
                      localStorage.setItem("cr_remember_me", e.target.checked ? "true" : "false");
                    }}
                  />
                  <span>Rester connecté</span>
                </label>

                <button
                  type="button"
                  className="auth-forgot-btn"
                  onClick={envoyerResetMotDePasse}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <button
                type="button"
                className="auth-submit-btn"
                onClick={login}
                disabled={loading}
              >
                Se connecter
              </button>

              <button
                type="button"
                className="auth-contact-btn"
                onClick={() => {
                  window.open("https://www.instagram.com/", "_blank");
                }}
              >
                📸 Suivre Coach Magalie
              </button>
            </div>

            {toast && <div className={`auth-status-floating ${toast.type}`}>{toast.message}</div>}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="pmagalieum-header">
          <div className="pmagalieum-brand">
            <div className="pmagalieum-logo"><img src="/cr-icon.png" alt="CR" /></div>
            <div>
              <div className="pmagalieum-eyebrow">Coach Magalie — Pilates & Bien-être</div>
              <div className="pmagalieum-mini">{role === "coach" ? "Espace coach" : "Espace sportif"}</div>
            </div>
          </div>
          <div className="pmagalieum-actions">
            {role === "coach" && <button className="icon-btn" onClick={() => setTab("notifications")} aria-label="Notifications">🔔{notificationsNonLues > 0 && <span className="icon-badge">{notificationsNonLues}</span>}</button>}
            {role === "coach" && <button className="icon-btn plus" onClick={() => (tab === "sportifs" ? setShowSportifModal(true) : setShowCoursModal(true))} aria-label="Ajouter">+</button>}
            {role === "sportif" && <button className="icon-btn plus" onClick={() => setShowDemandeModal(true)} aria-label="Demander un créneau">+</button>}
          </div>
        </div>

        <div className="pmagalieum-hero">
          <h1 className="hello-title">{role === "coach" ? `Bonjour Coach ${profile?.prenom || profile?.nom || "Magalie"} 👋` : `Bonjour ${sportifConnecte?.prenom || profile?.prenom || "Sportif"} 👋`}</h1>
          <div className="hello-sub">{role === "coach" ? "Voici un aperçu de votre activité" : "Votre espace sportif personnel"}</div>
          <div className="hero-tools">
            <button className="btn secondary" onClick={() => refreshAll()} disabled={loading}>Actualiser</button>
            <button className="btn red" onClick={logout}>Déconnexion</button>
          </div>
        </div>

        {role === "coach" && <div className="pmagalieum-grid">
          <div className="kpi pmagalieum-kpi"><div className="kpi-icon">👥</div><b>{sportifs.length}</b><span>Sportifs</span><div className="kpi-trend">Profils actifs</div></div>
          <div className="kpi pmagalieum-kpi"><div className="kpi-icon">📅</div><b>{cours.length}</b><span>Cours</span><div className="kpi-trend">Planning total</div></div>
          <div className="kpi pmagalieum-kpi"><div className="kpi-icon">📋</div><b>{totalInscrits}</b><span>Réservations</span><div className="kpi-trend">{remplissage}% de remplissage</div></div>
          <div className="kpi pmagalieum-kpi"><div className="kpi-icon">✉️</div><b>{demandesEnAttente}</b><span>Demandes</span><div className="kpi-trend">{euros(ca)} estimés</div></div>
        </div>}

        {role === "sportif" && <div className="pmagalieum-grid">
          <div className="kpi pmagalieum-kpi"><div className="kpi-icon">📅</div><b>{coursSemaine.length}</b><span>Cours</span><div className="kpi-trend">Cette semaine</div></div>
          <div className="kpi pmagalieum-kpi"><div className="kpi-icon">📋</div><b>{reservationsVisibles().length}</b><span>Réservations</span><div className="kpi-trend">Actives</div></div>
          <div className="kpi pmagalieum-kpi"><div className="kpi-icon">✉️</div><b>{demandesCreneaux.filter((d) => sportifConnecte && String(d.sportif_id) === String(sportifConnecte.id)).length}</b><span>Demandes</span><div className="kpi-trend">Créneaux envoyés</div></div>
          <div className="kpi pmagalieum-kpi"><div className="kpi-icon">👤</div><b>{sportifConnecte ? "OK" : "—"}</b><span>Profil</span><div className="kpi-trend">{sportifConnecte?.niveau || "À compléter"}</div></div>
        </div>}

        {role === "sportif" && <div className="sportif-quick-actions">
          <button className="btn" onClick={() => setTab("planning")}>Voir les cours</button>
          <button className="btn secondary" onClick={() => setShowDemandeModal(true)}>Demander un créneau</button>
        </div>}

        {tab === "planning" && <>
          <div className="mobile-planner-card">
            <div className="mobile-planner-head">
              <div className="mobile-planner-title"><span className="mobile-planner-title-icon">📅</span>{role === "coach" ? "Planning de la semaine" : "Mes cours de la semaine"}</div>
              <div className="mobile-planner-actions">
                {role === "coach" && <button className="btn" onClick={() => setShowCoursModal(true)}>+ Cours</button>}
                {role === "sportif" && sportifConnecte && <button className="btn" onClick={() => setShowDemandeModal(true)}>Demander</button>}
              </div>
            </div>

            <div className="week-picker">
              <button className="btn secondary" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>‹</button>
              <div className="week-picker-label">{fmtDate(weekStart)} → {fmtDate(weekEnd)}</div>
              <button className="btn secondary" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>›</button>
            </div>

            <div className="week-days">
              {weekDays.map((d) => (
                <div className={`day-chip ${d.date === todayISO() ? "today" : ""}`} key={d.date}>
                  <span>{d.short}</span>
                  <span>{d.label}</span>
                </div>
              ))}
            </div>

            <div className="planner-grid">
              <div className="time-col">{planningHours.map((h) => <span key={h}>{h}h</span>)}</div>
              {coursSemaine.map((c, index) => (
                <div
                  className={`planner-event ${index % 3 === 1 ? "alt" : ""} ${getCoursDurationMinutes(c) >= 120 ? "long" : ""}`}
                  key={c.id}
                  style={getCoursGridStyle(c)}
                  onClick={() => role === "coach" ? ouvrirModificationCours(c) : setSelectedCours(c)}
                >
                  <div className="planner-event-time">{fmtHoraire(c)}</div>
                  <div className="planner-event-title">{c.titre}</div>
                  {getCoursDurationMinutes(c) >= 120 && <div className="planner-event-duration">{formatCoursDuration(c)}</div>}
                </div>
              ))}
              {!coursSemaine.length && <div className="planner-empty"><div className="empty-state"><span className="empty-state-icon">📅</span><span className="empty-state-text">Aucun cours cette semaine.</span></div></div>}
            </div>
          </div>

          <div className="cards">
            {coursSemaine.map((c) => { const inscrits = activeReservationsForCours(c.id); const pct = c.capacite_max ? Math.round((inscrits.length / c.capacite_max) * 100) : 0; return <div className="course" key={c.id}><div className="course-head"><div><h3>{c.titre}</h3><div className="meta">{fmtDate(c.date_cours)} · {fmtHoraire(c)} · {c.lieu || "Lieu non renseigné"}</div></div><div style={{textAlign:"right"}}><div className="badge">{euros(c.tarif)}</div><div className="badge green" style={{marginTop:6}}>{Math.max(c.capacite_max - inscrits.length,0)} place(s)</div></div></div><div className="bar"><div className="fill" style={{width:`${Math.min(pct,100)}%`}} /></div><div className="badges"><span className="badge">{inscrits.length}/{c.capacite_max}</span></div><div className="actions"><button className="btn secondary" onClick={() => setSelectedCours(c)}>Voir / inscrire</button>{role === "coach" && <button className="btn secondary" onClick={() => ouvrirModificationCours(c)}>Modifier</button>}{role === "coach" && <button className="btn red" onClick={() => supprimerCours(c.id)}>Supprimer</button>}{role === "sportif" && sportifConnecte && (() => {
  const inscrit = estInscrit(c.id, sportifConnecte.id);
  return inscrit ? (
    <>
      <button className="btn green" disabled>✓ Réservé</button>
      <button className="btn red" onClick={() => retirerSportif(c.id, sportifConnecte.id)}>Annuler</button>
    </>
  ) : (
    <button className="btn" onClick={() => inscrireSportif(c.id, sportifConnecte.id)}>Réserver</button>
  );
})()}</div></div>})}
            {!coursSemaine.length && <div className="empty-state"><span className="empty-state-icon">📅</span><span className="empty-state-text">Aucun cours pour le moment.</span></div>}
          </div>
        </>}

        {tab === "reservations" && <><div className="section-title">{role === "coach" ? "Réservations" : "Mes réservations"}</div><div className="cards">{reservationsVisibles().map((r) => { const s = sportifs.find((x) => x.id === r.sportif_id); const c = cours.find((x) => x.id === r.cours_id); return <div className="person" key={r.id}><div className="person-head"><div><h3>{s ? `${s.prenom} ${s.nom}` : "Sportif supprimé"}</h3><div className="meta">{c ? `${c.titre} · ${c.jour_semaine} · ${fmtHoraire(c)}` : "Cours supprimé"} · statut : {r.statut || "active"}</div></div>{c && s && role === "coach" && <button className="btn red" onClick={() => retirerSportif(c.id, s.id)}>Retirer</button>}</div></div>})}{!reservationsVisibles().length && <div className="empty-state"><span className="empty-state-icon">📋</span><span className="empty-state-text">Aucune réservation pour le moment.</span></div>}</div></>}

        {tab === "sportifs" && role === "coach" && <><div className="row-title"><div className="section-title">Sportifs ({sportifs.length})</div><button className="btn" onClick={() => setShowSportifModal(true)}>+ Ajouter</button></div><div className="cards">{sportifs.map((s) => <div className="person" key={s.id}><div className="person-head"><div className="person-left"><div className="avatar">{initials(s)}</div><div><h3>{s.prenom} {s.nom}</h3><div className="meta">{nbReservationsSportif(s.id)} séance(s){s.niveau ? ` · ${s.niveau}` : ""}</div><div className="meta">{s.email || "Email non renseigné"}</div><div className="meta">{s.telephone || "Téléphone non renseigné"}</div>{s.notes && <div className="meta">Notes : {s.notes}</div>}</div></div><div className="actions" style={{marginTop:0}}><button className="btn secondary" onClick={() => ouvrirModificationSportif(s)}>Modifier</button><button className="btn red" onClick={() => supprimerSportif(s.id)}>Supprimer</button></div></div></div>)}{!sportifs.length && <div className="empty-state"><span className="empty-state-icon">👥</span><span className="empty-state-text">Aucun sportif pour le moment.</span></div>}</div></>}

        {tab === "demandes" && role === "coach" && <><div className="row-title"><div className="section-title">Demandes de créneaux {demandesEnAttente > 0 && <span className="notif-dot">{demandesEnAttente}</span>}</div></div><div className="demandes-switch"><button className={`btn ${!showDemandesArchives ? "green" : "secondary"}`} onClick={() => setShowDemandesArchives(false)}>En cours</button><button className={`btn ${showDemandesArchives ? "green" : "secondary"}`} onClick={() => setShowDemandesArchives(true)}>Archives</button></div><div className="cards">{demandesVisibles().map((d) => { const sportif = sportifs.find((s) => s.id === d.sportif_id); const statut = normalizeStatut(d.statut); return <div className={`notif-card ${statut === "en_attente" ? "unread" : ""}`} key={d.id}><div><h3 style={{margin:"0 0 6px"}}>{sportif ? `${sportif.prenom} ${sportif.nom}` : "Sportif"}</h3><div className="meta">Jour souhaité : {d.jour_souhaite || "Non renseigné"}</div><div className="meta">Message : {d.message || "Aucun message"}</div><div className="notif-date">{d.created_at ? new Date(d.created_at).toLocaleString("fr-FR") : ""}</div></div><div className="actions" style={{marginTop:0}}>{statut === "en_attente" ? <><button className="btn green" onClick={() => ouvrirCreationCoursDepuisDemande(d)}>Créer le cours</button><button className="btn red" onClick={() => changerStatutDemande(d.id, "refusee")}>Refuser</button></> : <span className={`badge ${statut === "acceptee" ? "green" : ""}`}>{libelleStatutDemande(d.statut)}</span>}</div></div>})}{!demandesVisibles().length && <div className="empty-state"><span className="empty-state-icon">✉️</span><span className="empty-state-text">Aucune demande de créneau pour le moment.</span></div>}</div></>}

        {tab === "notifications" && role === "coach" && <>
          <div className="row-title notifications-title">
            <div className="section-title">Notifications {notificationsNonLues > 0 && <span className="notif-dot">{notificationsNonLues}</span>}</div>
            <div className="notifications-toolbar">
              <button className="btn secondary" onClick={marquerToutesNotificationsLues}>Tout marquer comme lu</button>
              <button className="btn danger-outline" onClick={effacerToutesNotifications}>Effacer toutes les notifications</button>
            </div>
          </div>
          <div className="cards">
            {notifications.map((n) => {
              const sportif = n.sportif_id ? sportifs.find((s) => s.id === n.sportif_id) : null;
              return <div className={`notif-card ${n.lu ? "" : "unread"}`} key={n.id}>
                <div>
                  <h3>{n.titre}</h3>
                  <div className="meta">{n.message}</div>
                  {sportif && <div className="meta">Sportif : {sportif.prenom} {sportif.nom}</div>}
                  <div className="notif-date">{n.created_at ? new Date(n.created_at).toLocaleString("fr-FR") : ""}</div>
                </div>
                <div className="actions" style={{marginTop:0}}>
                  {!n.lu ? <button className="btn" onClick={() => marquerNotificationLue(n.id)}>Marquer comme lu</button> : <span className="badge green">Lu</span>}
                </div>
              </div>
            })}
            {!notifications.length && <div className="empty-state"><span className="empty-state-icon">🔔</span><span className="empty-state-text">Aucune notification pour le moment.</span></div>}
          </div>
        </>}

        {tab === "profil" && role === "sportif" && <><div className="row-title"><div className="section-title">Mon profil</div>{sportifConnecte && <button className="btn" onClick={() => setShowDemandeModal(true)}>Demander un créneau</button>}</div>{sportifConnecte ? <><div className="person"><div className="person-head"><div className="person-left"><div className="avatar">{initials(sportifConnecte)}</div><div><h3>{sportifConnecte.prenom} {sportifConnecte.nom}</h3><div className="meta">{sportifConnecte.email || "Email non renseigné"}</div><div className="meta">{sportifConnecte.telephone || "Téléphone non renseigné"}</div><div className="meta">{sportifConnecte.niveau ? `Niveau : ${sportifConnecte.niveau}` : "Niveau non renseigné"}</div></div></div></div></div><div className="section-title">Mes demandes</div><div className="cards">{demandesVisibles().map((d) => <div className="person" key={d.id}><div className="person-head"><div><h3>{d.jour_souhaite}</h3><div className="meta">{d.message}</div><div className="notif-date">{d.created_at ? new Date(d.created_at).toLocaleString("fr-FR") : ""}</div></div><span className={`badge ${normalizeStatut(d.statut) === "acceptee" ? "green" : ""}`}>{libelleStatutDemande(d.statut)}</span></div></div>)}{!demandesVisibles().length && <div className="empty-state"><span className="empty-state-icon">✉️</span><span className="empty-state-text">Aucune demande envoyée pour le moment.</span></div>}</div></> : <div className="empty-state"><span className="empty-state-icon">👤</span><span className="empty-state-text">Profil introuvable. Vérifie l'identifiant utilisé.</span></div>}</>}
      </div>

      {role === "coach" && <button className="floating" onClick={() => (tab === "sportifs" ? setShowSportifModal(true) : setShowCoursModal(true))}>+</button>}
      <div className="tabs"><div className="tabs-inner"><div className={`tab ${tab === "planning" ? "active" : ""}`} onClick={() => setTab("planning")}>📅<br/>Planning</div><div className={`tab ${tab === "reservations" ? "active" : ""}`} onClick={() => setTab("reservations")}>📋<br/>{role === "coach" ? "Réservations" : "Mes réservations"}</div>{role === "coach" && <div className={`tab ${tab === "demandes" ? "active" : ""}`} onClick={() => setTab("demandes")}>🕒{demandesEnAttente > 0 && <span className="notif-dot">{demandesEnAttente}</span>}<br/>Demandes</div>}{role === "coach" && <div className={`tab ${tab === "notifications" ? "active" : ""}`} onClick={() => setTab("notifications")}>🔔{notificationsNonLues > 0 && <span className="notif-dot">{notificationsNonLues}</span>}<br/>Notifications</div>}<div className={`tab ${(role === "coach" ? tab === "sportifs" : tab === "profil") ? "active" : ""}`} onClick={() => setTab(role === "coach" ? "sportifs" : "profil")}>{role === "coach" ? "👥" : "👤"}<br/>{role === "coach" ? "Sportifs" : "Profil"}</div></div></div>

      {demandePourCours && <div className="modal-bg" onClick={() => setDemandePourCours(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><h2>Accepter et créer un cours</h2>{(() => { const sportif = sportifs.find((s) => s.id === demandePourCours.sportif_id); return <><div className="kpi" style={{marginBottom:12}}><b style={{fontSize:18}}>{sportif ? `${sportif.prenom} ${sportif.nom}` : "Sportif"}</b><span>Demande : {demandePourCours.jour_souhaite} · {demandePourCours.message || "Aucun message"}</span></div><div className="two"><div className="field"><label>Titre</label><input value={coursDemandeForm.titre} onChange={(e) => setCoursDemandeForm({ ...coursDemandeForm, titre: e.target.value })}/></div><div className="field"><label>Jour</label><select value={coursDemandeForm.jour_semaine} onChange={(e) => setCoursDemandeForm({ ...coursDemandeForm, jour_semaine: e.target.value })}>{jours.map((j) => <option key={j}>{j}</option>)}</select></div><div className="field"><label>Date</label><input type="date" value={coursDemandeForm.date_cours} onChange={(e) => setCoursDemandeForm({ ...coursDemandeForm, date_cours: e.target.value })}/></div><div className="field"><label>Heure début</label><input type="time" value={coursDemandeForm.heure_debut} onChange={(e) => setCoursDemandeForm({ ...coursDemandeForm, heure_debut: e.target.value })}/></div><div className="field"><label>Heure fin</label><input type="time" value={coursDemandeForm.heure_fin} onChange={(e) => setCoursDemandeForm({ ...coursDemandeForm, heure_fin: e.target.value })}/></div><div className="field"><label>Lieu</label><input value={coursDemandeForm.lieu} onChange={(e) => setCoursDemandeForm({ ...coursDemandeForm, lieu: e.target.value })}/></div><div className="field"><label>Tarif</label><input type="number" value={coursDemandeForm.tarif} onChange={(e) => setCoursDemandeForm({ ...coursDemandeForm, tarif: e.target.value })}/></div><div className="field"><label>Nombre de places</label><input type="number" value={coursDemandeForm.capacite_max} onChange={(e) => setCoursDemandeForm({ ...coursDemandeForm, capacite_max: e.target.value })}/></div></div><div className="actions"><button className="btn green" onClick={creerCoursDepuisDemande} disabled={loading}>Créer le cours et accepter</button><button className="btn secondary" onClick={() => setDemandePourCours(null)}>Annuler</button></div></>; })()}</div></div>}

      {showSportifModal && <div className="modal-bg" onClick={() => setShowSportifModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><h2>Ajouter un sportif + accès</h2><div className="two"><div className="field"><label>Prénom</label><input value={newSportif.prenom} onChange={(e) => setNewSportif({ ...newSportif, prenom: e.target.value })}/></div><div className="field"><label>Nom</label><input value={newSportif.nom} onChange={(e) => setNewSportif({ ...newSportif, nom: e.target.value })}/></div><div className="field"><label>Email</label><input value={newSportif.email} onChange={(e) => setNewSportif({ ...newSportif, email: e.target.value })}/></div><div className="field"><label>Téléphone</label><input value={newSportif.telephone} onChange={(e) => setNewSportif({ ...newSportif, telephone: e.target.value })}/></div><div className="field"><label>Niveau</label><input value={newSportif.niveau} onChange={(e) => setNewSportif({ ...newSportif, niveau: e.target.value })}/></div><div className="field"><label>Notes coach</label><input value={newSportif.notes} onChange={(e) => setNewSportif({ ...newSportif, notes: e.target.value })}/></div></div><div className="actions"><button className="btn" onClick={ajouterSportif} disabled={loading}>Créer accès</button><button className="btn secondary" onClick={() => setShowSportifModal(false)}>Annuler</button></div></div></div>}

      {editingSportif && <div className="modal-bg" onClick={() => setEditingSportif(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><h2>Modifier le sportif</h2><div className="two"><div className="field"><label>Prénom</label><input value={editSportifForm.prenom} onChange={(e) => setEditSportifForm({ ...editSportifForm, prenom: e.target.value })}/></div><div className="field"><label>Nom</label><input value={editSportifForm.nom} onChange={(e) => setEditSportifForm({ ...editSportifForm, nom: e.target.value })}/></div><div className="field"><label>Email</label><input value={editSportifForm.email} onChange={(e) => setEditSportifForm({ ...editSportifForm, email: e.target.value })}/></div><div className="field"><label>Téléphone</label><input value={editSportifForm.telephone} onChange={(e) => setEditSportifForm({ ...editSportifForm, telephone: e.target.value })}/></div><div className="field"><label>Niveau</label><input value={editSportifForm.niveau} onChange={(e) => setEditSportifForm({ ...editSportifForm, niveau: e.target.value })}/></div><div className="field"><label>Notes coach</label><input value={editSportifForm.notes} onChange={(e) => setEditSportifForm({ ...editSportifForm, notes: e.target.value })}/></div></div><div className="actions"><button className="btn" onClick={modifierSportif} disabled={loading}>Enregistrer les modifications</button><button className="btn secondary" onClick={() => setEditingSportif(null)}>Annuler</button></div></div></div>}

      {showCoursModal && <div className="modal-bg" onClick={() => setShowCoursModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><h2>Créer un cours</h2><div className="two"><div className="field"><label>Titre</label><input value={newCours.titre} onChange={(e) => setNewCours({ ...newCours, titre: e.target.value })}/></div><div className="field"><label>Jour</label><select value={newCours.jour_semaine} onChange={(e) => setNewCours({ ...newCours, jour_semaine: e.target.value })}>{jours.map((j) => <option key={j}>{j}</option>)}</select></div><div className="field"><label>Date du pmagalieer cours</label><input type="date" value={newCours.date_cours} onChange={(e) => setNewCours({ ...newCours, date_cours: e.target.value })}/></div><div className="field"><label>Heure début</label><input type="time" value={newCours.heure_debut} onChange={(e) => setNewCours({ ...newCours, heure_debut: e.target.value })}/></div><div className="field"><label>Heure fin</label><input type="time" value={newCours.heure_fin} onChange={(e) => setNewCours({ ...newCours, heure_fin: e.target.value })}/></div><div className="field"><label>Lieu</label><input value={newCours.lieu} onChange={(e) => setNewCours({ ...newCours, lieu: e.target.value })}/></div><div className="field"><label>Tarif</label><input type="number" value={newCours.tarif} onChange={(e) => setNewCours({ ...newCours, tarif: e.target.value })}/></div><div className="field"><label>Capacité</label><input type="number" value={newCours.capacite_max} onChange={(e) => setNewCours({ ...newCours, capacite_max: e.target.value })}/></div><div className="field"><label>Récurrence</label><select value={newCours.recurrence} onChange={(e) => setNewCours({ ...newCours, recurrence: e.target.value as RecurrenceCours })}><option value="unique">Cours unique</option><option value="hebdo">Chaque semaine</option><option value="bihebdo">Toutes les 2 semaines</option><option value="mensuel">Tous les mois</option></select></div>{newCours.recurrence !== "unique" && <div className="field"><label>Répéter jusqu'au</label><input type="date" value={newCours.date_fin_recurrence} onChange={(e) => setNewCours({ ...newCours, date_fin_recurrence: e.target.value })}/></div>}</div>{newCours.recurrence !== "unique" && <div className="kpi" style={{marginTop:12,minHeight:"auto"}}><b style={{fontSize:18}}>{buildOccurrencesUntil(newCours.date_cours, newCours.recurrence, newCours.date_fin_recurrence).length} cours</b><span>{recurrenceLabel(newCours.recurrence)} du {fmtDate(newCours.date_cours)} au {fmtDate(newCours.date_fin_recurrence)}.</span></div>}<div className="actions"><button className="btn" onClick={creerCours} disabled={loading}>{newCours.recurrence === "unique" ? "Créer le cours" : "Créer les cours"}</button><button className="btn secondary" onClick={() => setShowCoursModal(false)}>Annuler</button></div></div></div>}

      {editingCours && <div className="modal-bg" onClick={() => setEditingCours(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><h2>Modifier le cours</h2><div className="two"><div className="field"><label>Titre</label><input value={editCoursForm.titre} onChange={(e) => setEditCoursForm({ ...editCoursForm, titre: e.target.value })}/></div><div className="field"><label>Jour</label><select value={editCoursForm.jour_semaine} onChange={(e) => setEditCoursForm({ ...editCoursForm, jour_semaine: e.target.value })}>{jours.map((j) => <option key={j}>{j}</option>)}</select></div><div className="field"><label>Date</label><input type="date" value={editCoursForm.date_cours} onChange={(e) => setEditCoursForm({ ...editCoursForm, date_cours: e.target.value })}/></div><div className="field"><label>Heure début</label><input type="time" value={editCoursForm.heure_debut} onChange={(e) => setEditCoursForm({ ...editCoursForm, heure_debut: e.target.value })}/></div><div className="field"><label>Heure fin</label><input type="time" value={editCoursForm.heure_fin} onChange={(e) => setEditCoursForm({ ...editCoursForm, heure_fin: e.target.value })}/></div><div className="field"><label>Lieu</label><input value={editCoursForm.lieu} onChange={(e) => setEditCoursForm({ ...editCoursForm, lieu: e.target.value })}/></div><div className="field"><label>Tarif</label><input type="number" value={editCoursForm.tarif} onChange={(e) => setEditCoursForm({ ...editCoursForm, tarif: e.target.value })}/></div><div className="field"><label>Capacité</label><input type="number" value={editCoursForm.capacite_max} onChange={(e) => setEditCoursForm({ ...editCoursForm, capacite_max: e.target.value })}/></div></div><div className="actions edit-course-actions"><button className="btn edit-save-btn" onClick={modifierCours} disabled={loading}>Enregistrer</button><button className="btn secondary edit-cancel-btn" onClick={() => setEditingCours(null)}>Annuler</button><button className="btn red edit-delete-btn" onClick={() => supprimerCours(editingCours.id)} disabled={loading}>Supprimer</button></div></div></div>}

      {selectedCours && <div className="modal-bg" onClick={() => setSelectedCours(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><h2>{selectedCours.titre}</h2><div className="meta">{fmtDate(selectedCours.date_cours)} · {fmtHoraire(selectedCours)} · {selectedCours.lieu || "Lieu non renseigné"} · {euros(selectedCours.tarif)}</div><h3>{peutVoirInscrits(selectedCours.id) ? `Inscrits (${sportifsInscrits(selectedCours.id).length}/${selectedCours.capacite_max})` : "Participants"}</h3>{peutVoirInscrits(selectedCours.id) ? <div className="list">{sportifsInscrits(selectedCours.id).map((s) => <div className="list-item" key={s.id}><div className="person-left"><div className="avatar">{initials(s)}</div><b>{s.prenom} {s.nom}</b></div>{role === "coach" && <button className="btn red" onClick={() => retirerSportif(selectedCours.id, s.id)}>Retirer</button>}
{role === "sportif" && sportifConnecte?.id === s.id && <button className="btn red" onClick={() => retirerSportif(selectedCours.id, s.id)}>Se désinscrire</button>}</div>)}{!sportifsInscrits(selectedCours.id).length && <div className="meta">Aucun inscrit.</div>}</div> : <div className="meta">Inscris-toi à ce cours pour voir les participants.</div>}{role === "coach" && <><h3>Ajouter un sportif</h3><div className="list">{sportifs.filter((s) => !sportifsInscrits(selectedCours.id).some((i) => i.id === s.id)).map((s) => <div className="list-item" key={s.id}><div className="person-left"><div className="avatar">{initials(s)}</div><b>{s.prenom} {s.nom}</b></div><button className="btn" onClick={() => inscrireSportif(selectedCours.id, s.id)} disabled={loading}>+ Inscrire</button></div>)}</div></>}<div className="actions">{role === "coach" && <button className="btn" onClick={() => ouvrirModificationCours(selectedCours)}>Modifier ce cours</button>}{role === "coach" && <button className="btn red" onClick={() => supprimerCours(selectedCours.id)} disabled={loading}>Supprimer ce cours</button>}<button className="btn secondary" onClick={() => setSelectedCours(null)}>Fermer</button></div></div></div>}

        {showDemandeModal && <div className="modal-bg" onClick={() => setShowDemandeModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><h2>Demander un créneau</h2><div className="field"><label>Jour souhaité</label><select value={newDemande.jour_souhaite} onChange={(e) => setNewDemande({ ...newDemande, jour_souhaite: e.target.value })}>{jours.map((j) => <option key={j}>{j}</option>)}</select></div><div className="field"><label>Message pour le coach</label><input value={newDemande.message} onChange={(e) => setNewDemande({ ...newDemande, message: e.target.value })} placeholder="Ex : disponible mardi après 18h" /></div><div className="actions"><button className="btn" onClick={envoyerDemandeCreneau} disabled={loading}>Envoyer la demande</button><button className="btn secondary" onClick={() => setShowDemandeModal(false)}>Annuler</button></div></div></div>}

      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </>
  );
}
