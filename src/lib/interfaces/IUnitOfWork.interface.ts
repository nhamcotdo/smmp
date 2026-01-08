import { IPostRepository } from './repositories/IPost.repository'
import { ISocialAccountRepository } from './repositories/ISocialAccount.repository'
import { IPostPublicationRepository } from './repositories/IPostPublication.repository'

export interface IUnitOfWork {
  posts: IPostRepository
  socialAccounts: ISocialAccountRepository
  publications: IPostPublicationRepository

  withTransaction<T>(callback: (uow: IUnitOfWork) => Promise<T>): Promise<T>
}

export interface IUnitOfWorkFactory {
  create(): Promise<IUnitOfWork>
}
