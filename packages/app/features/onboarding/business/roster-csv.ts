// The forgiving CSV mapper behind S24's roster import (doc 06 §5).
//
// "Forgiving" is a specific behaviour, not a tone: a business switching from
// TutorBird exports whatever its old tool exports, and a file that is rejected
// whole is a business that does not switch. So: guess the columns from whatever
// the headers are called, keep every good row, and name the bad ones by row
// number the way a spreadsheet numbers them — the operator fixes six cells, not
// the file format.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding business s24 csv import mapper roster columns rows

/** What a column can mean to us. `ignore` is a real answer, not a failure. */
export type ColumnRole =
  | 'learnerName'
  | 'guardianName'
  | 'guardianEmail'
  | 'grade'
  | 'phone'
  | 'ignore';

/**
 * Header spellings seen in the exports this has to swallow. Matching is done on
 * a normalised header ("Parent E-Mail" → "parentemail"), so only the shapes need
 * listing, not every punctuation variant.
 */
const ALIASES: Record<Exclude<ColumnRole, 'ignore'>, string[]> = {
  learnerName: ['student', 'studentname', 'learner', 'learnername', 'child', 'childname', 'name'],
  guardianName: ['parent', 'parentname', 'guardian', 'guardianname', 'contact', 'contactname'],
  guardianEmail: ['email', 'parentemail', 'guardianemail', 'contactemail', 'emailaddress'],
  grade: ['grade', 'gradelevel', 'year', 'yeargroup', 'class'],
  phone: ['phone', 'phonenumber', 'mobile', 'cell', 'contactnumber'],
};

const normalise = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * A CSV reader that handles the three things spreadsheet exports actually do:
 * quoted fields, commas inside them, and doubled quotes as an escape. Anything
 * more exotic than that is a dependency we would be carrying for one screen.
 * ponytail: no streaming — a roster is kilobytes, and the file is already in
 * memory by the time it reaches here.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // Close the row on the first newline char and swallow a following \n.
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // A trailing newline produces one empty row; a blank line mid-file is noise too.
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/**
 * Guess what each column is. First match wins per role, so a file with both
 * "Name" and "Student Name" does not map both to the learner — and an unmatched
 * column becomes `ignore` rather than an error, because extra columns are the
 * normal case in a real export.
 */
export function guessMapping(headers: string[]): ColumnRole[] {
  const taken = new Set<ColumnRole>();
  return headers.map((header) => {
    const key = normalise(header);
    for (const [role, aliases] of Object.entries(ALIASES) as [
      Exclude<ColumnRole, 'ignore'>,
      string[],
    ][]) {
      if (taken.has(role)) continue;
      if (aliases.includes(key)) {
        taken.add(role);
        return role;
      }
    }
    return 'ignore' as const;
  });
}

export interface RosterRow {
  /** 1-based and counting the header, so it matches the spreadsheet's own gutter. */
  line: number;
  learnerName: string;
  guardianName: string;
  guardianEmail: string;
  grade: string;
  phone: string;
  /** Empty when the row imports cleanly. */
  problems: string[];
}

export interface RosterImport {
  headers: string[];
  mapping: ColumnRole[];
  rows: RosterRow[];
  /** Rows that will actually be created. */
  ready: number;
  /** Row numbers to show the operator, the way Sprout Social names them. */
  problemLines: number[];
}

const valueOf = (cells: string[], mapping: ColumnRole[], role: ColumnRole) => {
  const i = mapping.indexOf(role);
  return i === -1 ? '' : (cells[i] ?? '').trim();
};

/**
 * A learner needs a name and a reachable guardian: doc 06 §2 forbids a child
 * account without a guardian behind it, so a nameless row or an unreachable
 * guardian is not a row we can import — but it is also not a reason to throw the
 * other 200 away.
 */
export function importRoster(text: string, override?: ColumnRole[]): RosterImport {
  const grid = parseCsv(text);
  const headers = grid[0] ?? [];
  const mapping = override ?? guessMapping(headers);
  const rows: RosterRow[] = grid.slice(1).map((cells, i) => {
    const row: RosterRow = {
      line: i + 2,
      learnerName: valueOf(cells, mapping, 'learnerName'),
      guardianName: valueOf(cells, mapping, 'guardianName'),
      guardianEmail: valueOf(cells, mapping, 'guardianEmail'),
      grade: valueOf(cells, mapping, 'grade'),
      phone: valueOf(cells, mapping, 'phone'),
      problems: [],
    };
    if (!row.learnerName) row.problems.push('No student name');
    if (!row.guardianEmail) row.problems.push('No guardian email');
    else if (!/.+@.+\..+/.test(row.guardianEmail)) row.problems.push('Guardian email looks wrong');
    return row;
  });

  return {
    headers,
    mapping,
    rows,
    ready: rows.filter((r) => r.problems.length === 0).length,
    problemLines: rows.filter((r) => r.problems.length > 0).map((r) => r.line),
  };
}

export const ROLE_LABELS: Record<ColumnRole, string> = {
  learnerName: 'Student name',
  guardianName: 'Guardian name',
  guardianEmail: 'Guardian email',
  grade: 'Grade',
  phone: 'Phone',
  ignore: "Don't import",
};
