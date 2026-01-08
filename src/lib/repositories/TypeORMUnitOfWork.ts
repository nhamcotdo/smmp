import { DataSource } from 'typeorm'
import {
  IUnitOfWork,
  IUnitOfWorkFactory,
} from '@/lib/interfaces/IUnitOfWork.interface'
import { TypeORMPostRepository } from './TypeORMPost.repository'
import { TypeORMSocialAccountRepository } from './TypeORMSocialAccount.repository'
import { TypeORMPostPublicationRepository } from './TypeORMPostPublication.repository'

export class TypeORMUnitOfWork implements IUnitOfWork {
  posts: TypeORMPostRepository
  socialAccounts: TypeORMSocialAccountRepository
  publications: TypeORMPostPublicationRepository

  constructor(
    private dataSource: DataSource,
    private entityManager?: any
  ) {
    if (entityManager) {
      this.posts = new TypeORMPostRepository({ getRepository: (entity: any) => entityManager.getRepository(entity) } as any)
      this.socialAccounts = new TypeORMSocialAccountRepository({ getRepository: (entity: any) => entityManager.getRepository(entity) } as any)
      this.publications = new TypeORMPostPublicationRepository({ getRepository: (entity: any) => entityManager.getRepository(entity) } as any)
    } else {
      this.posts = new TypeORMPostRepository(dataSource)
      this.socialAccounts = new TypeORMSocialAccountRepository(dataSource)
      this.publications = new TypeORMPostPublicationRepository(dataSource)
    }
  }

  async withTransaction<T>(callback: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return await this.dataSource.transaction(async (manager) => {
      const transactionalUoW = new TypeORMUnitOfWork(this.dataSource, manager)
      return await callback(transactionalUoW)
    })
  }
}

export class TypeORMUnitOfWorkFactory implements IUnitOfWorkFactory {
  constructor(private dataSource: DataSource) {}

  async create(): Promise<IUnitOfWork> {
    return new TypeORMUnitOfWork(this.dataSource)
  }
}
