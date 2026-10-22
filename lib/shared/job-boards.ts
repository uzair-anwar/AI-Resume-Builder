/** Known job boards. `login` boards never expose the description without signing in. */
export type JobBoard = {
  id: string;
  name: string;
  hosts: string[];
  /** "login": always needs an account in the browser; we do not try to fetch and just say so. */
  access: "open" | "login";
};

export const JOB_BOARDS: JobBoard[] = [
  // Always behind a login wall
  { id: "indeed", name: "Indeed", hosts: ["indeed.com"], access: "login" },
  { id: "linkedin", name: "LinkedIn", hosts: ["linkedin.com"], access: "login" },
  {
    id: "glassdoor",
    name: "Glassdoor",
    hosts: ["glassdoor.com", "glassdoor.co.uk"],
    access: "login",
  },

  // US / global
  { id: "wellfound", name: "Wellfound", hosts: ["wellfound.com", "angel.co"], access: "open" },
  { id: "monster", name: "Monster", hosts: ["monster.com"], access: "open" },
  { id: "levels", name: "Levels.fyi", hosts: ["levels.fyi"], access: "open" },
  { id: "ventureloop", name: "VentureLoop", hosts: ["ventureloop.com"], access: "open" },
  { id: "techcareers", name: "TechCareers", hosts: ["techcareers.com"], access: "open" },
  { id: "simplyhired", name: "SimplyHired", hosts: ["simplyhired.com"], access: "open" },
  { id: "builtin", name: "Built In", hosts: ["builtin.com"], access: "open" },
  { id: "himalayas", name: "Himalayas", hosts: ["himalayas.app"], access: "open" },
  { id: "workingnomads", name: "Working Nomads", hosts: ["workingnomads.com"], access: "open" },
  { id: "adzuna", name: "Adzuna", hosts: ["adzuna.com", "adzuna.co.uk"], access: "open" },
  { id: "lensa", name: "Lensa", hosts: ["lensa.com"], access: "open" },
  { id: "ziprecruiter", name: "ZipRecruiter", hosts: ["ziprecruiter.com"], access: "open" },
  { id: "landingjobs", name: "Landing.jobs", hosts: ["landing.jobs"], access: "open" },
  { id: "skipthedrive", name: "SkipTheDrive", hosts: ["skipthedrive.com"], access: "open" },
  { id: "rubyonremote", name: "Ruby On Remote", hosts: ["rubyonremote.com"], access: "open" },
  { id: "weworkremotely", name: "We Work Remotely", hosts: ["weworkremotely.com"], access: "open" },
  { id: "remotehabits", name: "Remote Habits", hosts: ["remotehabits.com"], access: "open" },
  { id: "justremote", name: "JustRemote", hosts: ["justremote.co"], access: "open" },
  { id: "remotecrew", name: "Remote Crew", hosts: ["remotecrew.io"], access: "open" },
  { id: "euremotejobs", name: "EU Remote Jobs", hosts: ["euremotejobs.com"], access: "open" },
  { id: "startupjobs", name: "Startup.jobs", hosts: ["startup.jobs"], access: "open" },
  { id: "mitratech", name: "Mitratech", hosts: ["mitratech.com"], access: "open" },
  { id: "myjobhelper", name: "MyJobHelper", hosts: ["myjobhelper.com"], access: "open" },
  { id: "clouddevs", name: "CloudDevs", hosts: ["clouddevs.com"], access: "open" },
  { id: "jobgether", name: "Jobgether", hosts: ["jobgether.com"], access: "open" },

  // Europe
  { id: "nofluffjobs", name: "No Fluff Jobs", hosts: ["nofluffjobs.com"], access: "open" },
  { id: "justjoin", name: "Just Join IT", hosts: ["justjoin.it"], access: "open" },
  { id: "reed", name: "Reed", hosts: ["reed.co.uk"], access: "open" },
  { id: "jobserve", name: "JobServe", hosts: ["jobserve.com"], access: "open" },

  // MENA
  { id: "bayt", name: "Bayt", hosts: ["bayt.com"], access: "open" },
  { id: "wuzzuf", name: "Wuzzuf", hosts: ["wuzzuf.net"], access: "open" },
  { id: "gulftalent", name: "GulfTalent", hosts: ["gulftalent.com"], access: "open" },
];

export function findJobBoard(hostname: string): JobBoard | undefined {
  const host = hostname.toLowerCase();
  return JOB_BOARDS.find((b) => b.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
}

export function loginRequiredMessage(boardName?: string): string {
  const who = boardName ?? "This job board";
  return `${who} requires you to sign in to view this job, and sign-in is not supported yet. Open the job in your browser, copy the description, and paste it below.`;
}

export function botBlockedMessage(boardName?: string): string {
  const who = boardName ?? "This site";
  return `${who} blocked automated access (sign-in or a bot check is required). Paste the job description below instead.`;
}
