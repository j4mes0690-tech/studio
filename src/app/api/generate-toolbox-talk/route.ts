import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // In a real application, you would integrate with an AI model here.
    // For this example, we'll return a static response based on the prompt.
    let toolboxTalkContent = `Toolbox Talk on: ${prompt}\n\n`;
    toolboxTalkContent += `Date: ${new Date().toLocaleDateString()}\n`;
    toolboxTalkContent += `Attendees: ________________________\n\n`;

    switch (prompt.toLowerCase()) {
      case 'site tidiness':
        toolboxTalkContent += `Topic: Maintaining a Tidy and Safe Site\n\n`;
        toolboxTalkContent += `Key Points:\n`;
        toolboxTalkContent += `- Keep work areas clear of debris and obstructions.\n`;
        toolboxTalkContent += `- Store tools and materials properly after use.\n`;
        toolboxTalkContent += `- Dispose of waste in designated bins.\n`;
        toolboxTalkContent += `- Report any tripping hazards or unsafe conditions.\n\n`;
        toolboxTalkContent += `Discussion Points: What are the benefits of a tidy site? What are the risks of an untidy site?\n\n`;
        break;
      case 'ladder safety':
        toolboxTalkContent += `Topic: Safe Use of Ladders\n\n`;
        toolboxTalkContent += `Key Points:\n`;
        toolboxTalkContent += `- Inspect ladders before each use for damage.\n`;
        toolboxTalkContent += `- Ensure ladders are placed on a firm, level surface.\n`;
        toolboxTalkContent += `- Maintain three points of contact while ascending or descending.\n`;
        toolboxTalkContent += `- Do not overreach; reposition the ladder as needed.\n\n`;
        toolboxTalkContent += `Discussion Points: When should you *not* use a ladder? What alternatives are there?\n\n`;
        break;
      default:
        toolboxTalkContent += `Topic: General Site Safety\n\n`;
        toolboxTalkContent += `Key Points:\n`;
        toolboxTalkContent += `- Always wear appropriate PPE.\n`;
        toolboxTalkContent += `- Be aware of your surroundings.\n`;
        toolboxTalkContent += `- Report all incidents, no matter how minor.\n`;
        toolboxTalkContent += `- Follow all site-specific safety procedures.\n\n`;
        toolboxTalkContent += `Discussion Points: What are some common hazards on site? How can we prevent them?\n\n`;
        break;
    }

    toolboxTalkContent += `Action Items: ________________________\n\n`;
    toolboxTalkContent += `Signed: ________________________\n`;

    return NextResponse.json({ toolboxTalkContent }, { status: 200 });
  } catch (error) {
    console.error('Error generating toolbox talk:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}