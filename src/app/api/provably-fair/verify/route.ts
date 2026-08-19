import { PUT as fairPut } from "@/app/api/fair/route";

export async function POST(req: Request) {
  return fairPut(req as never);
}
