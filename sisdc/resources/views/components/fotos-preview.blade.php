@props(['categoria'])

{{-- Miniaturas das fotos já anexadas nesta categoria (prévia imediata, antes do
     envio). Lê o array reativo `fotos` do escopo Alpine do Wizard. --}}
<div class="mt-2 flex flex-wrap gap-2">
    <template x-for="f in fotos.filter((x) => x.categoria === '{{ $categoria }}')" :key="f.client_uuid">
        <div class="relative">
            <img :src="f.url" class="h-20 w-20 rounded object-cover border border-slate-200" alt="Foto anexada">
            <button type="button" @click="removerFoto(f.client_uuid)"
                    class="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-600 text-white text-xs leading-none"
                    title="Remover foto">&times;</button>
        </div>
    </template>
</div>
