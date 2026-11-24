import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  MongoAbility,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

export class TaskSubject {
  id!: string;
  authorId!: string;

  constructor(data: { id: string; authorId: string }) {
    this.id = data.id;
    this.authorId = data.authorId;
  }
}

export interface CurrentUser {
  id: string;
  role: 'user' | 'admin';
}

export type Subjects = TaskSubject | typeof TaskSubject | 'all';
export type AppAbility = MongoAbility<[Action, Subjects]>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: CurrentUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role === 'admin') {
      can(Action.Manage, 'all');
    } else {
      can(Action.Delete, TaskSubject, { authorId: user.id });
    }

    return build({
      detectSubjectType: (item) =>
        (item as object).constructor as ExtractSubjectType<Subjects>,
    });
  }
}
