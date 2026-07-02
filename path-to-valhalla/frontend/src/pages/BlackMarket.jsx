import { ShoppingBag } from 'lucide-react';
import ComingSoonFeature from './ComingSoonFeature';

function BlackMarket() {
    return (
        <ComingSoonFeature
            title="Mercado Negro"
            description="Comercio clandestino de objetos raros, materiales prohibidos y ofertas de alto riesgo."
            icon={ShoppingBag}
        />
    );
}

export default BlackMarket;
