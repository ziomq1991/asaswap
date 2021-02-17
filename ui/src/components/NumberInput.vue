<template>
  <div>
    <label
      v-if="label"
      :class="labelClass"
    >{{ label }}</label>
    <slot name="input">
      <t-input
        input="tel"
        v-bind="$attrs"
        :variant="variant"
        :value="value"
        :placeholder="placeholder"
        v-on="inputListeners"
        @input="onInput"
        @keypress="onKeyPress"
        @change="onChange"
      />
    </slot>
    <p
      v-if="errorMessage"
      class="text-red-900"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
<script>
export default {
  name: 'NumberInput',
  inheritAttrs: false,
  props: {
    label: {
      type: String,
      default: null,
      required: false,
    },
    error: {
      default: false,
      type: Boolean,
    },
    errorMessage: {
      default: '',
      type: String,
    },
    value: {
      type: [String, Number],
      required: false,
      default: null
    },
    placeholder: {
      type: String,
      required: false,
      default: '0.0'
    },
    allowDecimals: {
      type: Boolean,
      default: true
    }
  },
  computed: {
    variant() {
      return this.error || this.errorMessage ? 'danger' : '';
    },
    labelClass() {
      return this.error || this.errorMessage ? 'text-red-900' : '';
    },
    inputListeners: function () {
      return this.$listeners;
    }
  },
  methods: {
    onChange(value) {
      this.$emit('change', value);
    },
    onInput(value) {
      if (this.allowDecimals) {
        value = String(value).replace(/(?<=\..*)\./g, '');
        value = String(value).replace(/[^.0-9]+/g, '');
      } else {
        value = String(value).replace(/[^0-9]+/g, '');
      }
      this.$forceUpdate();
      this.$emit('input', value);
    },
    onKeyPress(e) {
      var allowedKeys = /[0-9]|\./;
      if (!this.allowDecimals) {
        allowedKeys = /[0-9]/;
      }
      if (!allowedKeys.test(e.key)) {
        e.preventDefault();
      }
    }
  },
};
</script>
