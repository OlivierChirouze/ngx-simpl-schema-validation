import 'rxjs/add/operator/startWith';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import SimpleSchema from 'simpl-schema';

interface ISimpleSchemaValidatorFactoryErrors {
  [path: string]: {
    [type: string]: string;
  };
}

export class SimpleSchemaValidatorFactory {
  private context;
  private errors: ISimpleSchemaValidatorFactoryErrors = {};
  private formValueChangesSubscription: Subscription;

  constructor(
    private schema: any,
  ) {
    this.context = schema.newContext();
  }

  connectForm(form: AbstractControl) {
    const onValueChanges = (value) => {
      this.context.validate(this.context.clean(value));
      const validationErrors = this.context.validationErrors();
      const oldErrors = this.errors;
      const newErrors = validationErrors.reduce(
        (errors, { name: path, type }) => Object.assign(errors, {
          [path]: Object.assign({}, errors[path], {
            [type]: this.context.keyErrorMessage(path),
          }),
        }),
        {}
      );
      this.errors = newErrors;

      const paths = new Set([
        ...Object.keys(oldErrors),
        ...Object.keys(newErrors),
      ]);

      paths.forEach((path) => {
        const oldPathErrors = oldErrors[path] || {};
        const newPathErrors = newErrors[path] || {};
        const types = new Set([
          ...Object.keys(oldPathErrors),
          ...Object.keys(newPathErrors),
        ]);

        let pathValidityChanged = false;
        types.forEach((type) => {
          pathValidityChanged = pathValidityChanged || newPathErrors[type] !== oldPathErrors[type];
        });

        if (pathValidityChanged) {
          form.get(path).updateValueAndValidity({ onlySelf: true });
        }
      });
    };

    this.disconnectForm();
    this.formValueChangesSubscription = form.valueChanges
      .startWith(form.value)
      .subscribe(onValueChanges)
    ;
  }

  connectControl(control: AbstractControl, path?: string) {
    const validator = this.createControlValidator(path);
    if (validator) {
      control.setValidators(validator);
    } else {
      control.clearValidators();
    }

    if (control instanceof FormArray) {
      const { controls } = control;
      controls.forEach((childControl, key) => {
        const childPath = path ? `${path}.${key}` : `${key}`;
        this.connectControl(childControl, childPath);
      });
    } else if (control instanceof FormGroup) {
      const { controls } = control;
      Object.keys(controls).forEach((key) => {
        const childControl = controls[key];
        const childPath = path ? `${path}.${key}` : key;
        this.connectControl(childControl, childPath);
      });
    }
  }

  createControlValidator(path?: string): ValidatorFn {
    if (!path) {
      return () => null;
    }

    return () => this.errors[path] || null;
  }

  disconnectForm() {
    if (this.formValueChangesSubscription) {
      this.formValueChangesSubscription.unsubscribe();
    }
  }

  hasErrors(path: string, form: FormGroup): boolean {
    const control: AbstractControl = form.get(path);
    const errors = Object.keys(control.errors);
    return errors.reduce((hasError, error) => hasError || control.hasError(error), false);
  }

  getFirstError(path: string, form: FormGroup): string {
    const control: AbstractControl = form.get(path);
    const errors = Object
      .keys(control.errors)
      .filter(error =>
        typeof control.getError(error) === 'string'
      )
    ;
    return errors.length
      ? control.getError(errors[0])
      : null
    ;
  }
}