import { CronOptions } from "@citizenfx/decorators/shared/cron.decorator";
import { RegisteredCronJobModel } from "@citizenfx/models/registered-cron-job";
import { CronJobAlreadyRegisteredException } from "@citizenfx/exceptions/cron-job-already-registered.exception";
import { HandlerInvoker } from "@core/invokers/handler.invoker";
import { ConstructorType } from "@shared";

export class CronJobsRegistry {
  readonly #cronJobsByProviderAndMethodName = new Map<ConstructorType, Map<string, RegisteredCronJobModel>>();

  registerCronJob(
    instance: object,
    methodName: string,
    options: CronOptions,
    provider: ConstructorType,
    handlerInvoker: HandlerInvoker,
  ): void {
    let cronJobsByMethodName = this.#cronJobsByProviderAndMethodName.get(provider);

    if (!cronJobsByMethodName) {
      cronJobsByMethodName = new Map();
      this.#cronJobsByProviderAndMethodName.set(provider, cronJobsByMethodName);
    }

    if (cronJobsByMethodName.has(methodName)) {
      throw new CronJobAlreadyRegisteredException(
        `A cron job is already registered for method ${methodName} in provider ${provider.name}.`,
      );
    }

    const handle = async () => {
      await handlerInvoker.invoke({ type: "CRON", provider: instance, methodName });
    };

    cronJobsByMethodName.set(methodName, new RegisteredCronJobModel(handle, options, provider, methodName));
  }

  getCronJobByProviderAndMethodName(provider: ConstructorType, methodName: string): RegisteredCronJobModel | undefined {
    return this.#cronJobsByProviderAndMethodName.get(provider)?.get(methodName);
  }

  getCronJobsByProvider(provider: ConstructorType): RegisteredCronJobModel[] {
    const cronJobsByMethodName = this.#cronJobsByProviderAndMethodName.get(provider);

    if (!cronJobsByMethodName) {
      return [];
    }

    return Array.from(cronJobsByMethodName.values());
  }

  getAllCronJobs(): RegisteredCronJobModel[] {
    const allCronJobs: RegisteredCronJobModel[] = [];

    for (const cronJobsByMethodName of this.#cronJobsByProviderAndMethodName.values()) {
      allCronJobs.push(...cronJobsByMethodName.values());
    }

    return allCronJobs;
  }
}
