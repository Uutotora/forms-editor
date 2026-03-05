export interface ApprovalStatus {
  rosstat: string;
  depr: string;
  ntu: string;
  dit: string;
}

export interface CardFields {
  id: string;
  abbreviation: string;
  fillType: string;
  precondition: string;
  questionText: string;
  helpText: string;
}

export interface ControlRow {
  id: string;
  type: string;
  conditions: string;
  strictness: string;
}

export interface AnswerRow {
  number: string;
  type: string;
  headerText: string;
  hintText: string;
  defaultValue: string;
  code: string;
  nextId: string;
}

export interface Question {
  sheetName: string;
  title: string;
  approval: ApprovalStatus;
  card: CardFields;
  controls: ControlRow[];
  answers: AnswerRow[];
  hasChanges?: boolean;
}

export interface QuestionSummary {
  sheetName: string;
  title: string;
  hasChanges: boolean;
}
