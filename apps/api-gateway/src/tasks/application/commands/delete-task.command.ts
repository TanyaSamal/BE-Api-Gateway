export class DeleteTaskCommand {
  constructor(
    public readonly taskId: string,
    public readonly deletedBy: string,
  ) {}
}
