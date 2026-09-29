import { DependencyGraph } from "@core/graphs/dependency.graph";
import { ValidationRuleInterface } from "@core/interfaces/validation-rule.interface";
import { ScopeMapsInterface } from "@core/interfaces/scope-maps.interface";
import { ScopeMapsBuilder } from "@core/builders/scope-maps.builder";
import { OptionsArraysValidationRule } from "@core/validation-rules/options-arrays.rule";
import { DependencyTypesValidationRule } from "@core/validation-rules/dependency-types.rule";
import { ScopeValidationRule } from "@core/validation-rules/scope.rule";

export class DependencyValidator {
  readonly #rules: ValidationRuleInterface[];

  constructor(private readonly graph: DependencyGraph) {
    this.#rules = [
      new OptionsArraysValidationRule(),
      new DependencyTypesValidationRule(graph),
      new ScopeValidationRule(graph),
    ];
  }

  validateAll(): ScopeMapsInterface {
    const scopeMaps = ScopeMapsBuilder.build(this.graph);
    const nodes = this.graph.getAllNodes();

    for (const rule of this.#rules) {
      rule.validate(nodes, scopeMaps);
    }

    return scopeMaps;
  }
}
