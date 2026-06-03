@props(['label', 'model'])
{{-- Par de rádios Sim/Não ligado a um booleano nullable do Alpine (em branco = não respondido). --}}
@php $grupo = 'sn_'.\Illuminate\Support\Str::random(8); @endphp
<div class="text-sm">
    <span class="block text-slate-600">{{ $label }}</span>
    <div class="flex gap-4 mt-0.5">
        <label class="flex items-center gap-1">
            <input type="radio" name="{{ $grupo }}" :value="true" x-model="{{ $model }}"> Sim
        </label>
        <label class="flex items-center gap-1">
            <input type="radio" name="{{ $grupo }}" :value="false" x-model="{{ $model }}"> Não
        </label>
    </div>
</div>
