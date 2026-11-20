/**
 * The text of the Privacy, Terms and Account pages (drawn by src/components/legal).
 *
 * Single source of truth: change a statement here and every page that shows it follows.
 * Each section says whether it describes how the app works today, or what the planned
 * account feature will do once it exists; the page labels them so a reader can tell. Keep
 * this file true to the code: when storage, network use or the cloud plan changes, update
 * the text in the same commit. It is plain-language information, not legal advice, and the
 * owner should have it reviewed before accounts go live.
 */
import { appConfig } from './app'

/** Which part of the app a section describes. */
export type LegalScope = 'today' | 'account'

/** The words shown on a section's label, by scope. */
export const legalScopeLabel: Record<LegalScope, string> = {
  today: 'Today',
  account: 'With an account (coming)',
}

export interface LegalSection {
  id: string
  heading: string
  /** Absent for a section that holds for both. */
  scope?: LegalScope
  paragraphs: string[]
  bullets?: string[]
  /** A link shown after the text. */
  link?: { label: string; href: string }
}

export type LegalPageId = 'privacy' | 'terms' | 'account'

export interface LegalPage {
  title: string
  intro: string
  sections: LegalSection[]
}

const repository = appConfig.repository.url
const issues = { label: 'Open an issue on GitHub', href: `${repository}/issues` }
const provider = 'Supabase'
const region = 'US East (N. Virginia)'
const minimumAge = 13
const contentSource = '5etools-mirror-3/5etools-src'

const contact: LegalSection = {
  id: 'contact',
  heading: 'Contact',
  paragraphs: [
    'Questions, requests about your data and reports of content that should be removed all go through the same place: the project page on GitHub. There is no email address.',
  ],
  link: issues,
}

export const legalConfig = {
  /** The date the three pages were last changed. Update it with every change of text. */
  lastUpdated: '2026-11-19',
  cloud: { provider, region },
  minimumAge,
  pages: {
    privacy: {
      title: 'Privacy policy',
      intro: `${appConfig.name} is a free fan tool. This page says what it keeps about you, where, and who can see it. It is written for players, in plain English, and it is not legal advice. Parts marked "Today" describe how the app works right now. Parts marked "With an account (coming)" describe a feature that does not exist yet and will only apply once it does.`,
      sections: [
        {
          id: 'short-version',
          heading: 'The short version',
          paragraphs: [
            'Today the app keeps everything on your own device and sends nothing about you to anyone. It has no accounts, no analytics, no advertising and no cookies. Your characters never leave your browser unless you export them yourself.',
          ],
        },
        {
          id: 'on-device',
          heading: 'What is stored on your device',
          scope: 'today',
          paragraphs: [
            "The app saves your work in your browser's own storage, on your device only. It is not sent to this site or to anyone else. Clearing the site's data in your browser, or using a private window, removes it.",
          ],
          bullets: [
            'Your characters: everything you enter, including a portrait picture if you add one.',
            "Each character's history log: a record, with times, of what was done to the character, such as edits, rolls and level ups. It stays with the character, and it is included in the file when you export the character, so anyone you give that file to can read it.",
            'Settings: the theme, table layouts, window sizes, dice look, sheet template and your content choices.',
            'Downloaded book content: the full rules and book text your browser fetched (see the next section).',
          ],
        },
        {
          id: 'content-downloads',
          heading: 'Book content your browser downloads',
          scope: 'today',
          paragraphs: [
            `This site hosts only the free rules (see the Terms page). The rest of the book content is downloaded by your own browser, straight from a public copy of the 5etools data on GitHub (by default ${contentSource}), through the jsDelivr content network or GitHub. It never passes through this site. The address of that source is a setting you can change.`,
            'Those services see your internet address and the files you ask for, as any website does when you visit it, and they have their own privacy policies. This site does not control them and receives nothing from those requests.',
          ],
        },
        {
          id: 'no-tracking',
          heading: 'Analytics, cookies and trackers',
          scope: 'today',
          paragraphs: [
            'None. The app contains no analytics, no advertising, no tracking pixels and no social media widgets, and it sets no cookies. It uses your browser storage (local storage and IndexedDB) only to keep what is listed above. The site is served from GitHub Pages, which, like any web host, may keep ordinary server logs of visits.',
          ],
        },
        {
          id: 'export',
          heading: 'Getting your data out',
          scope: 'today',
          paragraphs: [
            'Each character can be exported to a file (JSON) from the app, with its history, and imported again later or on another device. That file is yours; the app keeps no copy of it.',
          ],
        },
        {
          id: 'cloud-processor',
          heading: 'Who handles your data with an account',
          scope: 'account',
          paragraphs: [
            `An account will be optional. The app will keep working fully without one. If you make an account, your data will be stored with ${provider}, a hosted database service, in its ${region} data centre in the United States. ${provider} stores and serves the data on behalf of this project. Sign-in will be by email link, Google or Discord.`,
          ],
        },
        {
          id: 'cloud-data',
          heading: 'What an account will store, and why',
          scope: 'account',
          paragraphs: [
            'Only what is needed to run the account and the features you switch on:',
          ],
          bullets: [
            "Your email address, and the sign-in provider and its id for your account, to let you sign in and to tell your data apart from everyone else's.",
            'The characters you choose to keep in the cloud, with their history logs, so they follow you between devices and can be recovered.',
            'For each character, whether it is private or shared, and if shared, the link or public listing that makes it visible. A shared build holds names and source codes only, never book text.',
            'Comments or votes you post, once those features exist, with your display name.',
          ],
        },
        {
          id: 'cloud-sharing',
          heading: 'Who can see it',
          scope: 'account',
          paragraphs: [
            'Cloud characters will be private to you by default. A character you mark as shared or public can be read, not changed, by other people, and its history may be visible to a Dungeon Master you give it to. Making it private again hides it from then on, but cannot take back copies someone already saved or exported. The people who run this project will use the data only to operate the service and to deal with abuse reports.',
          ],
        },
        {
          id: 'cloud-retention',
          heading: 'How long it is kept',
          scope: 'account',
          paragraphs: [
            "Account data is kept until you delete it or the account. Deleted data is removed from the live database immediately. Copies in the project's own backups and in the hosting provider's backups are overwritten on their normal schedule.",
            'The project plans to keep a periodic full export of the stored data, outside the hosting provider, so that the service can be moved if it ever has to. Deleted accounts are left out of the next export.',
          ],
        },
        {
          id: 'cloud-deletion',
          heading: 'Deleting your account and your data',
          scope: 'account',
          paragraphs: [
            'You will be able to delete your account yourself, at any time, from the Account page, which lists the steps. You can export your characters first.',
          ],
        },
        {
          id: 'children',
          heading: 'Children',
          paragraphs: [
            `This app is not directed at children under ${minimumAge}, and accounts, when they exist, are for people ${minimumAge} or older. We do not knowingly collect personal data from children under ${minimumAge}. If you think a child has made an account, tell us (see Contact) and it will be deleted.`,
          ],
        },
        {
          id: 'changes',
          heading: 'Changes to this policy',
          paragraphs: [
            'When this policy changes, the "Last updated" date at the top changes with it. A change that affects what is collected about you, such as the start of accounts, will be shown in the app before it applies to you.',
          ],
        },
        contact,
      ],
    },
    terms: {
      title: 'Terms of use',
      intro: `By using ${appConfig.name} you agree to these terms. They are short on purpose. Parts marked "Today" apply now. Parts marked "With an account (coming)" apply once accounts exist.`,
      sections: [
        {
          id: 'what-this-is',
          heading: 'What this is',
          scope: 'today',
          paragraphs: [
            `${appConfig.name} is a free fan-made tool by ${appConfig.author} for building and playing Dungeons & Dragons characters. It is not a product of, and is not affiliated with, endorsed by or sponsored by, Wizards of the Coast. Dungeons & Dragons and D&D are trademarks of Wizards of the Coast LLC.`,
          ],
        },
        {
          id: 'free-rules',
          heading: 'The free rules in this site',
          scope: 'today',
          paragraphs: [
            'The rules content this site hosts comes from the System Reference Document 5.1 and the System Reference Document 5.2.1, by Wizards of the Coast LLC, licensed under the Creative Commons Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/legalcode). The material is stored as structured data and laid out by this app, which is a change to it. The full attribution text is in the data folder of the site.',
            'The source code of the app is released under the MIT License, in the project repository.',
          ],
          link: { label: 'Project repository on GitHub', href: repository },
        },
        {
          id: 'your-content',
          heading: 'Content you download yourself',
          scope: 'today',
          paragraphs: [
            'Other book content is not hosted or provided by this site. Your own browser fetches it from a third-party source that you can choose and change. What you download, and whether you are allowed to have and use it, is your responsibility, and so is respecting the rights of its owners. Do not use the app to share or redistribute book content.',
          ],
        },
        {
          id: 'warranty',
          heading: 'No warranty',
          scope: 'today',
          paragraphs: [
            'The app is provided as it is, with no promise that it is correct, complete, always available or free of mistakes. A ruling by your Dungeon Master always wins over the app. Characters live in your browser, which can lose them (cleared site data, a lost device), so export the ones you care about. To the extent the law allows, the author is not liable for loss or damage from using the app.',
          ],
        },
        {
          id: 'use',
          heading: 'Acceptable use',
          scope: 'account',
          paragraphs: [
            "Once accounts and shared builds exist, you agree not to post, share or link anything that is illegal, abusive, hateful, harassing, sexually explicit, or that infringes someone else's rights, and not to post other people's personal information, copied book text or art, or spam. You are responsible for what you post. You also agree not to attack, overload, scrape in bulk or try to break into the service.",
          ],
        },
        {
          id: 'moderation',
          heading: 'Moderation and removal',
          scope: 'account',
          paragraphs: [
            'Shared builds and comments may be reviewed, hidden or removed, and a repeat offender can lose the account, at the discretion of the project owner and without notice when the content is harmful. To report something, use the contact link below.',
          ],
        },
        {
          id: 'your-account',
          heading: 'Your account and ending it',
          scope: 'account',
          paragraphs: [
            `You may delete your account at any time, as the Account page explains. We may suspend or end an account that breaks these terms, or end the whole service, in which case you will be told in the app first where possible and given time to export your characters. You must be ${minimumAge} or older to have an account.`,
          ],
        },
        {
          id: 'changes',
          heading: 'Changes to these terms',
          paragraphs: [
            'These terms may change. The "Last updated" date shows when. Using the app after a change means you accept the new terms.',
          ],
        },
        contact,
      ],
    },
    account: {
      title: 'Your account',
      intro:
        'Accounts are coming. Today there is nothing to sign in to: the app works fully on your own device, with no account. This page says what accounts will do and, in particular, how deleting one will work.',
      sections: [
        {
          id: 'status',
          heading: 'Where this stands',
          scope: 'today',
          paragraphs: [
            'There are no accounts yet, so there is no account data to delete. Your characters are stored on your device only, and you can remove them there at any time.',
          ],
        },
        {
          id: 'optional',
          heading: 'What an account will be for',
          scope: 'account',
          paragraphs: [
            'An optional account will keep your characters in the cloud so they follow you between devices, and will allow sharing them privately or publicly. The app will keep working fully without one.',
          ],
        },
        {
          id: 'delete',
          heading: 'How deleting an account will work',
          scope: 'account',
          paragraphs: [
            'This page will have a "Delete account" button, after you sign in. It will ask you to confirm once, and then delete straight away, with no waiting period:',
          ],
          bullets: [
            'Your account, and the email address and sign-in details stored with it.',
            'Every copy of your characters in the cloud, with their history, and any sharing links or public listings they had.',
            'Your comments and votes, or, where they must stay so a discussion makes sense, they will be shown with no name on them.',
          ],
        },
        {
          id: 'local-stays',
          heading: 'What deleting will not touch',
          scope: 'account',
          paragraphs: [
            'The characters stored on your own device are not touched. They stay in your browser, and keep working, exactly as before. Copies other people already saved or exported from a shared character are theirs and cannot be taken back. Backups are overwritten on their normal schedule (see the privacy policy).',
          ],
        },
        {
          id: 'help',
          heading: 'Cannot sign in, or want it done for you',
          scope: 'account',
          paragraphs: [
            'If you cannot sign in, ask for the account to be deleted through the contact link below, and say which sign-in it uses. It will be deleted once it is confirmed to be yours.',
          ],
          link: issues,
        },
        {
          id: 'export-first',
          heading: 'Keeping a copy first',
          scope: 'today',
          paragraphs: [
            'Every character can be exported to a file from the app, with its history, before you delete anything. That works today and will keep working with an account.',
          ],
        },
      ],
    },
  } satisfies Record<LegalPageId, LegalPage>,
} as const

/** The footer's links to the pages, in order. */
export const legalLinks: readonly { id: LegalPageId; label: string }[] = [
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'account', label: 'Account' },
]
