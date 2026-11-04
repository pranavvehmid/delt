# What other mail sorters do (and what DELT takes from them)

Surveyed 14 open-source projects on GitHub (stars as of Nov 2026). DELT is for one kind of user, a VIT student on a free budget, so the question for each idea was: does it help a student keep up with college mail, at zero cost?

| # | Project | ★ | Core idea | Taken into DELT |
|---|---|---|---|---|
| 1 | [elie222/inbox-zero](https://github.com/elie222/inbox-zero) | 12.9k | AI assistant, plain-English rules, Reply Zero, bulk unsubscribe/archive, analytics | **My rules** (plain "if sender/word → pile" rules), **bulk actions**, mail-per-day analytics |
| 2 | [Mail-0/Zero](https://github.com/Mail-0/Zero) | 10.9k | Privacy-first open email client, unified inbox | Read-only by default, never store bodies, one calm inbox view |
| 3 | [langchain-ai/agents-from-scratch](https://github.com/langchain-ai/agents-from-scratch) | 2.4k | Triage every mail into *ignore / notify / respond* | The four piles stay; **New** is a pure triage step |
| 4 | [Gururagavendra/gmail-cleaner](https://github.com/Gururagavendra/gmail-cleaner) | 2.1k | Sender stats, delete/archive/mark-read by sender, filters | **Senders** view: who mails you most, one tap to mute or mark all read |
| 5 | [labnol/unsubscribe-gmail](https://github.com/labnol/unsubscribe-gmail) | 1.6k | One-click unsubscribe from bulk mail | **Unsubscribe** link shown for promotions that carry `List-Unsubscribe` |
| 6 | [InboxWhiz/gmail-declutter-extension](https://github.com/InboxWhiz/gmail-declutter-extension) | 483 | Top senders by volume, bulk sender actions | Same as #4 |
| 7 | [justjake/gmail-unsubscribe](https://github.com/justjake/gmail-unsubscribe) | 301 | Label-driven unsubscribing | Not taken: VIT lists can't be unsubscribed; **mute sender** instead |
| 8 | [dbish/DispatchMail](https://github.com/dbish/DispatchMail) | 188 | Whitelist which mail the AI may see | Only unclear mail goes to the free AI; rules handle the rest |
| 9 | [Lakshay1509/NeatMail](https://github.com/Lakshay1509/NeatMail) | 146 | Promise/deadline tracking, daily briefing, auto-archive expired mail | **Deadlines** tab, **Today** brief, past-deadline mail leaves the plan automatically |
| 10 | [popcorn101/maileven](https://github.com/popcorn101/maileven) | — | Screen mail against your interests (e.g. *Hackathons*), TL;DR, calendar sync | **Interests** boost matching chances; **Add to Google Calendar** on every deadline |
| 11 | [deepak-jha-kgp/smart-inbox](https://github.com/deepak-jha-kgp/smart-inbox) | — | Your tags and rules first, summaries, nothing sent without review | Rules first, AI second; DELT never sends mail |
| 12 | [juhimehta2529/Priority-Based-Gmail-Notification-System](https://github.com/juhimehta2529/Priority-Based-Gmail-Notification-System) | — | Alerts tiered by priority (10 min / 2 h / daily) | Planned: alerts for Urgent only |
| 13 | [RClayGates/gmail_auto_label](https://github.com/RClayGates/gmail_auto_label) | — | Auto-label via Gmail labels and filters | Already: `MailSort/*` labels mirror DELT's piles |
| 14 | [yegor256/wring](https://github.com/yegor256/wring) | — | A "smart inbox" that hides noise by rules | Noise pile + mute |

## What DELT deliberately skips

- **AI reply drafting** (inbox-zero, NeatMail, smart-inbox): students rarely reply to college broadcasts, and it would need paid AI.
- **Deleting mail** (gmail-cleaner): DELT never deletes; Noise and mute are reversible.
- **Multiple providers** (Zero): VIT mail is Gmail only.

## The workflow it adds up to

1. **Today**: see what needs you (top 3, due soon, questions to answer).
2. **New**: triage unread mail one swipe at a time.
3. **Deadlines**: plan the week; every deadline can go to Google Calendar.
4. **Chances**: hackathons and contests, sorted by your interests and closing date.
5. **Inbox**: everything else, plus senders, rules and bulk clean-up.
