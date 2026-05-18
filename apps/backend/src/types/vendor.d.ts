declare module '@google/generative-ai' {
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    getGenerativeModel(options: {
      model: string;
      tools?: unknown[];
      generationConfig?: Record<string, unknown>;
    }): GenerativeModel;
  }

  interface GenerativeModel {
    generateContent(
      request: string | { contents: unknown[] },
    ): Promise<GenerateContentResult>;
  }

  interface GenerateContentResult {
    response: {
      text(): string;
    };
  }
}

declare module 'docx' {
  export enum HeadingLevel {
    HEADING_1 = 'Heading1',
    HEADING_2 = 'Heading2',
    HEADING_3 = 'Heading3',
  }

  export enum AlignmentType {
    CENTER = 'center',
    LEFT = 'left',
    RIGHT = 'right',
    JUSTIFIED = 'both',
  }

  export interface IRunOptions {
    text?: string;
    bold?: boolean;
    italics?: boolean;
    size?: number;
    color?: string;
  }

  export class TextRun {
    constructor(options: IRunOptions | string);
  }

  export interface IParagraphOptions {
    text?: string;
    heading?: HeadingLevel;
    alignment?: AlignmentType;
    spacing?: { before?: number; after?: number };
    children?: (TextRun | unknown)[];
  }

  export class Paragraph {
    constructor(options: IParagraphOptions | string);
  }

  export interface IDocumentOptions {
    sections: Array<{
      properties?: Record<string, unknown>;
      children: Paragraph[];
    }>;
  }

  export class Document {
    constructor(options: IDocumentOptions);
  }

  export class Packer {
    static toBuffer(doc: Document): Promise<Buffer>;
  }
}
